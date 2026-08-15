import { readFileSync } from "node:fs";
import type {
  Diagnostic,
  RouteDiscoveryExplain,
  RouteDiscoveryResult,
  RouteOrigin,
} from "@a11yst/types";
import { parse } from "@babel/parser";
import * as t from "@babel/types";
import { walkFiles } from "../utils/fs-walk.js";
import { makeDiscoveredRoute, skippedPattern } from "../utils/routes.js";

const SOURCE_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);
const ROUTER_PACKAGES = new Set(["react-router", "react-router-dom"]);
const ROUTER_FACTORY_NAMES = new Set([
  "createBrowserRouter",
  "createHashRouter",
  "useRoutes",
]);
const ROUTER_IMPORT_SOURCES = new Set(["react-router", "react-router-dom"]);

type ParsedRoute = {
  path: string;
  pattern: string;
  dynamic: boolean;
  origin: RouteOrigin;
  sourceFile: string;
  sourceLine?: number;
};

type MutableDiscovery = {
  routes: ParsedRoute[];
  skipped: Array<{
    pattern: string;
    reason: string;
    sourceFile?: string;
    sourceLine?: number;
  }>;
  routerEvidence: Set<string>;
  sourceRouteHits: number;
};

function visitAst(node: t.Node, visitor: (node: t.Node) => void): void {
  visitor(node);
  for (const key of t.VISITOR_KEYS[node.type] ?? []) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const child of value) {
        if (t.isNode(child)) {
          visitAst(child, visitor);
        }
      }
    } else if (t.isNode(value)) {
      visitAst(value, visitor);
    }
  }
}

function packageHasRouterDependency(packageJson: object | undefined): string[] {
  if (!packageJson || typeof packageJson !== "object") {
    return [];
  }
  const evidence: string[] = [];
  const sections = ["dependencies", "devDependencies", "peerDependencies"] as const;
  for (const section of sections) {
    const deps = (packageJson as Record<string, unknown>)[section];
    if (!deps || typeof deps !== "object") {
      continue;
    }
    for (const name of Object.keys(deps as Record<string, unknown>)) {
      if (ROUTER_PACKAGES.has(name)) {
        evidence.push(`package.json ${section}: ${name}`);
      }
    }
  }
  return evidence;
}

function normalizeRoutePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

function joinRoutePaths(parent: string, child: string): string {
  if (child.startsWith("/")) {
    return normalizeRoutePath(child);
  }
  if (parent === "/") {
    return normalizeRoutePath(child);
  }
  return normalizeRoutePath(`${parent}/${child}`);
}

function isDynamicRoutePath(path: string): boolean {
  return /[:*]/.test(path);
}

type RouteJsxElementName = t.JSXOpeningElement["name"];

function isRouteJsxName(name: RouteJsxElementName): boolean {
  if (t.isJSXIdentifier(name)) {
    return name.name === "Route";
  }
  if (t.isJSXMemberExpression(name)) {
    return t.isJSXIdentifier(name.property) && name.property.name === "Route";
  }
  return false;
}

function readStringLiteral(node: t.Node | null | undefined): string | undefined {
  if (!node) {
    return undefined;
  }
  if (t.isStringLiteral(node)) {
    return node.value;
  }
  if (t.isTemplateLiteral(node) && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

function resolveStaticPath(
  node: t.Node | null | undefined,
  constants: ReadonlyMap<string, string>,
): string | undefined {
  if (!node) {
    return undefined;
  }
  const literal = readStringLiteral(node);
  if (literal !== undefined) {
    return literal;
  }
  if (t.isIdentifier(node)) {
    return constants.get(node.name);
  }
  if (t.isJSXExpressionContainer(node)) {
    return resolveStaticPath(node.expression, constants);
  }
  return undefined;
}

function collectStringConstants(program: t.Program): Map<string, string> {
  const constants = new Map<string, string>();
  for (const statement of program.body) {
    if (!t.isVariableDeclaration(statement)) {
      continue;
    }
    for (const declarator of statement.declarations) {
      if (!t.isIdentifier(declarator.id) || !declarator.init) {
        continue;
      }
      const value = resolveStaticPath(declarator.init, constants);
      if (value !== undefined) {
        constants.set(declarator.id.name, value);
      }
    }
  }
  return constants;
}

function collectArrayConstants(program: t.Program): Map<string, t.ArrayExpression> {
  const arrays = new Map<string, t.ArrayExpression>();
  for (const statement of program.body) {
    if (!t.isVariableDeclaration(statement)) {
      continue;
    }
    for (const declarator of statement.declarations) {
      if (!t.isIdentifier(declarator.id) || !declarator.init) {
        continue;
      }
      if (t.isArrayExpression(declarator.init)) {
        arrays.set(declarator.id.name, declarator.init);
      }
    }
  }
  return arrays;
}

function readBooleanAttribute(
  attributes: readonly t.JSXAttribute[],
  name: string,
): boolean {
  for (const attribute of attributes) {
    if (!t.isJSXIdentifier(attribute.name) || attribute.name.name !== name) {
      continue;
    }
    if (attribute.value === null) {
      return true;
    }
    if (t.isStringLiteral(attribute.value)) {
      return attribute.value.value === "true";
    }
    if (t.isJSXExpressionContainer(attribute.value)) {
      const expr = attribute.value.expression;
      if (t.isBooleanLiteral(expr)) {
        return expr.value;
      }
    }
  }
  return false;
}

function readPathAttribute(
  attributes: readonly t.JSXAttribute[],
  constants: ReadonlyMap<string, string>,
): { path?: string; unresolved: boolean; line?: number } {
  for (const attribute of attributes) {
    if (!t.isJSXIdentifier(attribute.name) || attribute.name.name !== "path") {
      continue;
    }
    const line = attribute.loc?.start.line;
    if (attribute.value === null) {
      return { unresolved: true, line };
    }
    if (t.isStringLiteral(attribute.value)) {
      return { path: attribute.value.value, unresolved: false, line };
    }
    if (t.isJSXExpressionContainer(attribute.value)) {
      const resolved = resolveStaticPath(attribute.value.expression, constants);
      if (resolved !== undefined) {
        return { path: resolved, unresolved: false, line };
      }
      return { unresolved: true, line };
    }
  }
  return { unresolved: false };
}

function recordResolvedRoute(
  discovery: MutableDiscovery,
  input: {
    resolvedPath: string;
    origin: RouteOrigin;
    sourceFile: string;
    sourceLine?: number;
    unresolvedReason?: string;
  },
): void {
  const pattern = normalizeRoutePath(input.resolvedPath);
  if (input.unresolvedReason) {
    discovery.skipped.push({
      pattern,
      reason: input.unresolvedReason,
      sourceFile: input.sourceFile,
      sourceLine: input.sourceLine,
    });
    return;
  }
  if (isDynamicRoutePath(pattern)) {
    discovery.skipped.push({
      pattern,
      reason: "requires configured value",
      sourceFile: input.sourceFile,
      sourceLine: input.sourceLine,
    });
    return;
  }

  discovery.routes.push({
    path: pattern,
    pattern,
    dynamic: false,
    origin: input.origin,
    sourceFile: input.sourceFile,
    sourceLine: input.sourceLine,
  });
}

function processRouteObject(
  discovery: MutableDiscovery,
  object: t.ObjectExpression,
  parentPath: string,
  sourceFile: string,
  constants: ReadonlyMap<string, string>,
  arrayConstants: ReadonlyMap<string, t.ArrayExpression>,
): void {
  let rawPath: string | undefined;
  let pathLine: number | undefined;
  let indexRoute = false;
  let childrenArray: t.ArrayExpression | undefined;
  let pathUnresolved = false;

  for (const property of object.properties) {
    if (!t.isObjectProperty(property)) {
      continue;
    }
    const keyName = t.isIdentifier(property.key)
      ? property.key.name
      : t.isStringLiteral(property.key)
        ? property.key.value
        : undefined;
    if (!keyName) {
      continue;
    }

    if (keyName === "path") {
      pathLine = property.loc?.start.line;
      rawPath = resolveStaticPath(property.value, constants);
      if (rawPath === undefined && !t.isNullLiteral(property.value)) {
        pathUnresolved = true;
      }
    } else if (keyName === "index") {
      if (t.isBooleanLiteral(property.value)) {
        indexRoute = property.value.value;
      } else if (t.isIdentifier(property.value) && property.value.name === "true") {
        indexRoute = true;
      }
    } else if (keyName === "children") {
      if (t.isArrayExpression(property.value)) {
        childrenArray = property.value;
      } else if (t.isIdentifier(property.value)) {
        childrenArray = arrayConstants.get(property.value.name);
      }
    }
  }

  let routePath = parentPath;
  if (indexRoute) {
    recordResolvedRoute(discovery, {
      resolvedPath: parentPath,
      origin: "react-router-object",
      sourceFile,
      sourceLine: pathLine,
    });
    routePath = normalizeRoutePath(parentPath);
  } else if (pathUnresolved) {
    recordResolvedRoute(discovery, {
      resolvedPath: parentPath,
      origin: "react-router-object",
      sourceFile,
      sourceLine: pathLine,
      unresolvedReason: "path expression is not a static string",
    });
  } else if (rawPath !== undefined) {
    routePath = joinRoutePaths(parentPath, rawPath);
    recordResolvedRoute(discovery, {
      resolvedPath: routePath,
      origin: "react-router-object",
      sourceFile,
      sourceLine: pathLine,
    });
  }

  if (childrenArray) {
    for (const element of childrenArray.elements) {
      if (t.isObjectExpression(element)) {
        processRouteObject(
          discovery,
          element,
          routePath,
          sourceFile,
          constants,
          arrayConstants,
        );
      }
    }
  }
}

function processRouteArrayExpression(
  discovery: MutableDiscovery,
  array: t.ArrayExpression,
  parentPath: string,
  sourceFile: string,
  constants: ReadonlyMap<string, string>,
  arrayConstants: ReadonlyMap<string, t.ArrayExpression>,
): void {
  for (const element of array.elements) {
    if (t.isObjectExpression(element)) {
      processRouteObject(
        discovery,
        element,
        parentPath,
        sourceFile,
        constants,
        arrayConstants,
      );
    }
  }
}

function isRoutesJsxName(name: RouteJsxElementName): boolean {
  if (t.isJSXIdentifier(name)) {
    return name.name === "Routes";
  }
  if (t.isJSXMemberExpression(name)) {
    return t.isJSXIdentifier(name.property) && name.property.name === "Routes";
  }
  return false;
}

function processRouteJsxElement(
  discovery: MutableDiscovery,
  element: t.JSXElement,
  parentPath: string,
  sourceFile: string,
  constants: ReadonlyMap<string, string>,
  processedRoutes: WeakSet<t.JSXElement>,
): void {
  if (!isRouteJsxName(element.openingElement.name)) {
    return;
  }
  processedRoutes.add(element);

  const attributes = element.openingElement.attributes.filter(
    (attribute): attribute is t.JSXAttribute => t.isJSXAttribute(attribute),
  );
  const { path: rawPath, unresolved, line } = readPathAttribute(attributes, constants);
  const indexRoute = readBooleanAttribute(attributes, "index");

  let routePath = parentPath;
  if (indexRoute) {
    recordResolvedRoute(discovery, {
      resolvedPath: parentPath,
      origin: "react-jsx-route",
      sourceFile,
      sourceLine: line,
    });
    routePath = normalizeRoutePath(parentPath);
  } else if (rawPath !== undefined) {
    routePath = joinRoutePaths(parentPath, rawPath);
    recordResolvedRoute(discovery, {
      resolvedPath: routePath,
      origin: "react-jsx-route",
      sourceFile,
      sourceLine: line,
    });
  } else if (unresolved) {
    discovery.skipped.push({
      pattern: normalizeRoutePath(parentPath),
      reason: "path expression is not a static string",
      sourceFile,
      sourceLine: line,
    });
  }

  for (const child of element.children) {
    if (t.isJSXElement(child)) {
      processRouteJsxElement(
        discovery,
        child,
        routePath,
        sourceFile,
        constants,
        processedRoutes,
      );
    }
  }
}

function resolveRouteArrayArgument(
  node: t.Node,
  arrayConstants: ReadonlyMap<string, t.ArrayExpression>,
): t.ArrayExpression | undefined {
  if (t.isArrayExpression(node)) {
    return node;
  }
  if (t.isIdentifier(node)) {
    return arrayConstants.get(node.name);
  }
  return undefined;
}

function parseReactRouterSource(
  sourceFile: string,
  content: string,
  discovery: MutableDiscovery,
): void {
  let program: t.Program;
  try {
    const file = parse(content, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      errorRecovery: true,
    });
    program = file.program;
  } catch {
    return;
  }

  const constants = collectStringConstants(program);
  const arrayConstants = collectArrayConstants(program);
  const processedRoutes = new WeakSet<t.JSXElement>();

  visitAst(program, (node) => {
    if (t.isImportDeclaration(node) && t.isStringLiteral(node.source)) {
      if (ROUTER_IMPORT_SOURCES.has(node.source.value)) {
        discovery.routerEvidence.add(`import from "${node.source.value}" in ${sourceFile}`);
        for (const specifier of node.specifiers) {
          if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
            if (ROUTER_FACTORY_NAMES.has(specifier.imported.name)) {
              discovery.routerEvidence.add(
                `${specifier.imported.name} import in ${sourceFile}`,
              );
            }
          }
        }
      }
    }

    if (t.isJSXElement(node) && isRoutesJsxName(node.openingElement.name)) {
      for (const child of node.children) {
        if (t.isJSXElement(child) && isRouteJsxName(child.openingElement.name)) {
          discovery.sourceRouteHits += 1;
          processRouteJsxElement(
            discovery,
            child,
            "/",
            sourceFile,
            constants,
            processedRoutes,
          );
        }
      }
    }

    if (
      t.isJSXElement(node) &&
      isRouteJsxName(node.openingElement.name) &&
      !processedRoutes.has(node)
    ) {
      discovery.sourceRouteHits += 1;
      processRouteJsxElement(
        discovery,
        node,
        "/",
        sourceFile,
        constants,
        processedRoutes,
      );
    }

    if (t.isCallExpression(node) && t.isIdentifier(node.callee)) {
      if (!ROUTER_FACTORY_NAMES.has(node.callee.name)) {
        return;
      }
      discovery.routerEvidence.add(`${node.callee.name}() in ${sourceFile}`);
      const firstArg = node.arguments[0];
      if (!firstArg || t.isSpreadElement(firstArg)) {
        return;
      }
      const array = resolveRouteArrayArgument(firstArg, arrayConstants);
      if (array) {
        processRouteArrayExpression(
          discovery,
          array,
          "/",
          sourceFile,
          constants,
          arrayConstants,
        );
      }
    }
  });
}

function dedupeParsedRoutes(routes: ParsedRoute[]): ParsedRoute[] {
  const seen = new Set<string>();
  const result: ParsedRoute[] = [];
  for (const route of routes.sort((a, b) => a.path.localeCompare(b.path))) {
    if (seen.has(route.path)) {
      continue;
    }
    seen.add(route.path);
    result.push(route);
  }
  return result;
}

function dedupeSkipped(
  skipped: MutableDiscovery["skipped"],
): MutableDiscovery["skipped"] {
  const seen = new Set<string>();
  const result: MutableDiscovery["skipped"] = [];
  for (const entry of skipped) {
    const key = `${entry.pattern}:${entry.reason}:${entry.sourceFile ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(entry);
  }
  return result;
}

export function discoverReactRoutes(
  projectRoot: string,
  packageJson: object | undefined,
): RouteDiscoveryResult {
  const diagnostics: Diagnostic[] = [];
  const discovery: MutableDiscovery = {
    routes: [],
    skipped: [],
    routerEvidence: new Set(packageHasRouterDependency(packageJson)),
    sourceRouteHits: 0,
  };

  const entries = walkFiles(projectRoot, { maxDepth: 8 }).filter(
    (entry) =>
      !entry.isDirectory &&
      SOURCE_EXTENSIONS.has(entry.relativePath.slice(entry.relativePath.lastIndexOf("."))),
  );

  for (const entry of entries) {
    let content: string;
    try {
      content = readFileSync(entry.absolutePath, "utf8");
    } catch {
      continue;
    }
    parseReactRouterSource(entry.relativePath, content, discovery);
  }

  if (discovery.sourceRouteHits > 0) {
    discovery.routerEvidence.add("JSX <Route> elements in source");
  }

  const routerDetected = discovery.routerEvidence.size > 0;
  const parsedRoutes = dedupeParsedRoutes(discovery.routes);
  const skipped = dedupeSkipped(discovery.skipped);

  const routes = parsedRoutes.map((route) =>
    makeDiscoveredRoute(route.path, route.origin, {
      pattern: route.pattern,
      sourceFile: route.sourceFile,
      sourceLine: route.sourceLine,
      dynamic: route.dynamic,
    }),
  );

  const skippedPatterns = skipped.map((entry) =>
    skippedPattern(entry.pattern, entry.reason, entry.sourceFile, entry.sourceLine),
  );

  const explain: RouteDiscoveryExplain = {
    strategy: routerDetected
      ? "static react-router AST scan"
      : "no react-router evidence",
    routerDetected,
    routerEvidence: [...discovery.routerEvidence].sort(),
    fallbackUsed: false,
    unresolved: skippedPatterns.map((entry) => ({
      pattern: entry.pattern,
      reason: entry.reason,
      ...(entry.sourceFile !== undefined ? { sourceFile: entry.sourceFile } : {}),
      ...(entry.sourceLine !== undefined ? { sourceLine: entry.sourceLine } : {}),
    })),
  };

  if (routerDetected && routes.length === 0 && skippedPatterns.length === 0) {
    diagnostics.push({
      code: "REACT_ROUTES_NONE_DISCOVERED",
      severity: "info",
      message:
        "React Router is present but no static routes could be resolved from source.",
      hint: "Add explicit routes in a11yst.config.ts or use static path strings in Route definitions.",
    });
  }

  if (!routerDetected && routes.length === 0) {
    diagnostics.push({
      code: "REACT_ROUTER_NOT_DETECTED",
      severity: "info",
      message: "No React Router dependency or route definitions were detected.",
      hint: "Configure routes explicitly in a11yst.config.ts when not using React Router.",
    });
  }

  return {
    routes,
    skippedPatterns,
    diagnostics,
    explain,
  };
}
