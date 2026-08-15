import type { SourceRegion } from "@a11yst/types";
import type { ReactSourceElement, ReactSourceElementKind } from "@a11yst/types";
import { parse } from "@babel/parser";
import * as t from "@babel/types";
import {
  ALLOWED_PROPS,
  EXCLUDED_PROPS,
} from "./constants.js";
import {
  isSensitiveValue,
  normalizeText,
  sortStringArray,
  truncateText,
} from "./sanitize.js";

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

export type ParseReactFileOptions = {
  maxElementsPerFile: number;
  maxPropsPerElement: number;
  maxTextLength: number;
};

export type ParseReactFileResult = {
  elements: ReactSourceElement[];
  hasJsx: boolean;
  parseFailed: boolean;
  parseWarning: boolean;
  truncatedElements: boolean;
  truncatedProps: boolean;
  truncatedText: boolean;
  dynamicProps: number;
  spreadProps: number;
  intrinsicElements: number;
  componentUsages: number;
  spreadDiagnostics: number;
  dynamicDiagnostics: number;
  fragmentIgnored: number;
  errorMessage?: string;
};

type OwnerFrame = {
  name: string;
};

function babelLocToRegion(loc: t.SourceLocation): SourceRegion {
  return {
    start: {
      line: loc.start.line,
      column: loc.start.column + 1,
    },
    end: {
      line: loc.end.line,
      column: loc.end.column + 1,
    },
  };
}

function openingRegion(openingElement: t.JSXOpeningElement): SourceRegion | undefined {
  const loc = openingElement.loc ?? openingElement.name.loc;
  if (!loc) {
    return undefined;
  }
  return babelLocToRegion(loc);
}

function isPascalCase(name: string): boolean {
  return /^[A-Z][A-Za-z0-9_$]*$/.test(name);
}

function isEventHandlerProp(name: string): boolean {
  return /^on[A-Z]/.test(name);
}

function isAllowedProp(name: string): boolean {
  if (EXCLUDED_PROPS.has(name)) {
    return false;
  }
  if (isEventHandlerProp(name)) {
    return false;
  }
  if (name.startsWith("data-") && !ALLOWED_PROPS.has(name)) {
    return false;
  }
  if (name.startsWith("aria-") && !ALLOWED_PROPS.has(name)) {
    return false;
  }
  return ALLOWED_PROPS.has(name);
}

function isSafeHref(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (/^javascript:/i.test(trimmed)) {
    return false;
  }
  if (/^data:/i.test(trimmed) && trimmed.length > 256) {
    return false;
  }
  if (/^[^:]+:\/\/[^/]*@/.test(trimmed)) {
    return false;
  }
  return true;
}

function staticTemplateValue(node: t.TemplateLiteral): string | undefined {
  if (node.expressions.length > 0) {
    return undefined;
  }
  return node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join("");
}

function staticExpressionValue(
  expression: t.Expression | t.JSXEmptyExpression,
): string | number | boolean | undefined {
  if (t.isJSXEmptyExpression(expression)) {
    return undefined;
  }
  if (t.isStringLiteral(expression)) {
    return expression.value;
  }
  if (t.isNumericLiteral(expression)) {
    return expression.value;
  }
  if (t.isBooleanLiteral(expression)) {
    return expression.value;
  }
  if (t.isTemplateLiteral(expression)) {
    return staticTemplateValue(expression);
  }
  return undefined;
}

function extractClassNames(value: string | number | boolean): string[] {
  if (typeof value !== "string") {
    return [];
  }
  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  return sortStringArray(tokens);
}

function getJsxName(
  name: t.JSXOpeningElement["name"],
): { kind: ReactSourceElementKind; tagName?: string; componentName?: string } | undefined {
  if (t.isJSXIdentifier(name)) {
    if (name.name === "Fragment") {
      return undefined;
    }
    if (/^[a-z]/.test(name.name)) {
      return { kind: "intrinsic", tagName: name.name };
    }
    return { kind: "component", componentName: name.name };
  }
  if (t.isJSXMemberExpression(name)) {
    const parts: string[] = [];
    let current: t.JSXMemberExpression | t.JSXIdentifier = name;
    while (t.isJSXMemberExpression(current)) {
      parts.unshift(current.property.name);
      current = current.object;
    }
    if (t.isJSXIdentifier(current)) {
      if (current.name === "React" && parts.length === 1 && parts[0] === "Fragment") {
        return undefined;
      }
      parts.unshift(current.name);
    }
    return { kind: "component", componentName: parts.join(".") };
  }
  return undefined;
}

function collectStaticText(
  children: Array<t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXElement | t.JSXFragment>,
  maxTextLength: number,
): { text?: string; dynamic: boolean } {
  const parts: string[] = [];
  for (const child of children) {
    if (t.isJSXText(child)) {
      parts.push(child.value);
      continue;
    }
    if (t.isJSXExpressionContainer(child)) {
      const value = staticExpressionValue(child.expression);
      if (typeof value === "string") {
        parts.push(value);
        continue;
      }
      return { dynamic: true };
    }
    if (t.isJSXElement(child)) {
      const nested = collectStaticText(child.children, maxTextLength);
      if (nested.dynamic) {
        return { dynamic: true };
      }
      if (nested.text) {
        parts.push(nested.text);
      }
      continue;
    }
    if (t.isJSXFragment(child)) {
      const nested = collectStaticText(child.children, maxTextLength);
      if (nested.dynamic) {
        return { dynamic: true };
      }
      if (nested.text) {
        parts.push(nested.text);
      }
      continue;
    }
    return { dynamic: true };
  }
  const normalized = normalizeText(parts.join(" "));
  if (!normalized) {
    return { dynamic: false };
  }
  if (isSensitiveValue(normalized)) {
    return { dynamic: true };
  }
  return { text: truncateText(normalized, maxTextLength), dynamic: false };
}

function deriveStaticAccessibleName(input: {
  elementKind: ReactSourceElementKind;
  tagName?: string;
  componentName?: string;
  staticProps: Record<string, string | number | boolean>;
  staticVisibleText?: string;
}): string | undefined {
  const ariaLabel = input.staticProps["aria-label"];
  if (typeof ariaLabel === "string" && ariaLabel.trim()) {
    return normalizeText(ariaLabel);
  }
  const alt = input.staticProps.alt;
  if (typeof alt === "string" && alt.trim()) {
    return normalizeText(alt);
  }
  if (input.staticVisibleText) {
    if (
      input.elementKind === "intrinsic" &&
      (input.tagName === "button" || input.tagName === "a" || input.tagName === "label")
    ) {
      return input.staticVisibleText;
    }
    if (input.elementKind === "component" && input.componentName) {
      return input.staticVisibleText;
    }
  }
  const title = input.staticProps.title;
  if (typeof title === "string" && title.trim()) {
    return normalizeText(title);
  }
  return undefined;
}

function parserPlugins(uri: string): Array<"jsx" | "typescript"> {
  if (uri.endsWith(".tsx") || uri.endsWith(".ts")) {
    return ["typescript", "jsx"];
  }
  return ["jsx"];
}

export function parseReactSource(input: {
  uri: string;
  source: string;
  scopeIds: string[];
  projectNames?: string[];
  frameworks?: string[];
  options: ParseReactFileOptions;
}): ParseReactFileResult {
  const result: ParseReactFileResult = {
    elements: [],
    hasJsx: false,
    parseFailed: false,
    parseWarning: false,
    truncatedElements: false,
    truncatedProps: false,
    truncatedText: false,
    dynamicProps: 0,
    spreadProps: 0,
    intrinsicElements: 0,
    componentUsages: 0,
    spreadDiagnostics: 0,
    dynamicDiagnostics: 0,
    fragmentIgnored: 0,
  };

  let ast: t.File;
  try {
    ast = parse(input.source, {
      sourceType: "unambiguous",
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: parserPlugins(input.uri),
      errorRecovery: true,
      ranges: false,
      tokens: false,
      attachComment: false,
    });
  } catch (error) {
    result.parseFailed = true;
    result.errorMessage = error instanceof Error ? error.message.slice(0, 120) : "parse failed";
    return result;
  }

  const ownerStack: OwnerFrame[] = [];

  const pushOwner = (name: string | null | undefined): void => {
    if (name && isPascalCase(name)) {
      ownerStack.push({ name });
    }
  };

  const popOwner = (): void => {
    ownerStack.pop();
  };

  const catalogJsxElement = (jsxElement: t.JSXElement): void => {
    const openingElement = jsxElement.openingElement;
    const nameInfo = getJsxName(openingElement.name);
    if (!nameInfo) {
      return;
    }

    result.hasJsx = true;
    if (result.elements.length >= input.options.maxElementsPerFile) {
      result.truncatedElements = true;
      return;
    }

    const region = openingRegion(openingElement);
    if (!region) {
      return;
    }

    const staticProps: Record<string, string | number | boolean> = {};
    const dynamicPropNames: string[] = [];
    let hasSpreadProps = false;
    let spreadBeforeStaticProps = false;
    let sawSpread = false;

    for (const attribute of openingElement.attributes) {
      if (t.isJSXSpreadAttribute(attribute)) {
        hasSpreadProps = true;
        sawSpread = true;
        result.spreadProps += 1;
        result.spreadDiagnostics += 1;
        continue;
      }
      if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name)) {
        continue;
      }
      const propName = attribute.name.name;
      if (!isAllowedProp(propName)) {
        continue;
      }

      if (sawSpread) {
        spreadBeforeStaticProps = true;
      }

      if (Object.keys(staticProps).length >= input.options.maxPropsPerElement) {
        result.truncatedProps = true;
        continue;
      }

      if (attribute.value === null) {
        staticProps[propName] = true;
        continue;
      }

      if (t.isStringLiteral(attribute.value)) {
        const value = attribute.value.value;
        if (propName === "href" && !isSafeHref(value)) {
          dynamicPropNames.push(propName);
          result.dynamicProps += 1;
          continue;
        }
        if (isSensitiveValue(value)) {
          dynamicPropNames.push(propName);
          result.dynamicProps += 1;
          continue;
        }
        staticProps[propName] = value;
        continue;
      }

      if (t.isJSXExpressionContainer(attribute.value)) {
        const staticValue = staticExpressionValue(attribute.value.expression);
        if (staticValue === undefined) {
          dynamicPropNames.push(propName);
          result.dynamicProps += 1;
          result.dynamicDiagnostics += 1;
          continue;
        }
        if (typeof staticValue === "string" && isSensitiveValue(staticValue)) {
          dynamicPropNames.push(propName);
          result.dynamicProps += 1;
          continue;
        }
        if (propName === "href" && typeof staticValue === "string" && !isSafeHref(staticValue)) {
          dynamicPropNames.push(propName);
          result.dynamicProps += 1;
          continue;
        }
        staticProps[propName] = staticValue;
      }
    }

    const classNameValue = staticProps.className;
    const classNames =
      typeof classNameValue === "string" ? extractClassNames(classNameValue) : [];

    const textResult = collectStaticText(jsxElement.children, input.options.maxTextLength);
    if (textResult.dynamic) {
      result.dynamicProps += 1;
    }
    if (textResult.text && textResult.text.length >= input.options.maxTextLength) {
      result.truncatedText = true;
    }

    const element: ReactSourceElement = {
      uri: input.uri,
      region,
      elementKind: nameInfo.kind,
      tagName: nameInfo.tagName,
      componentName: nameInfo.componentName,
      ownerComponent: ownerStack.at(-1)?.name,
      staticProps,
      dynamicPropNames: sortStringArray(dynamicPropNames),
      classNames,
      hasSpreadProps,
      spreadBeforeStaticProps,
      staticVisibleText: textResult.text,
      scopeIds: [...input.scopeIds].sort((left, right) => left.localeCompare(right)),
    };

    element.staticAccessibleName = deriveStaticAccessibleName({
      elementKind: element.elementKind,
      tagName: element.tagName,
      componentName: element.componentName,
      staticProps: element.staticProps,
      staticVisibleText: element.staticVisibleText,
    });

    if (input.projectNames?.length) {
      element.projectNames = [...input.projectNames].sort((left, right) =>
        left.localeCompare(right),
      );
    }
    if (input.frameworks?.length) {
      element.frameworks = [...input.frameworks].sort((left, right) => left.localeCompare(right));
    }

    result.elements.push(element);
    if (element.elementKind === "intrinsic") {
      result.intrinsicElements += 1;
    } else {
      result.componentUsages += 1;
    }
  };

  const walkWithOwners = (node: t.Node): void => {
    if (result.truncatedElements) {
      return;
    }

    if (t.isFunctionDeclaration(node)) {
      pushOwner(node.id?.name);
      if (node.body) {
        walkWithOwners(node.body);
      }
      popOwner();
      return;
    }

    if (t.isVariableDeclarator(node)) {
      const ownsComponent =
        t.isIdentifier(node.id) &&
        isPascalCase(node.id.name) &&
        (t.isFunctionExpression(node.init) || t.isArrowFunctionExpression(node.init));
      if (ownsComponent && t.isIdentifier(node.id)) {
        pushOwner(node.id.name);
      }
      if (node.init) {
        walkWithOwners(node.init);
      }
      if (ownsComponent) {
        popOwner();
      }
      return;
    }

    if (t.isClassDeclaration(node)) {
      pushOwner(node.id?.name);
      if (node.body) {
        walkWithOwners(node.body);
      }
      popOwner();
      return;
    }

    if (t.isJSXFragment(node)) {
      result.fragmentIgnored += 1;
    }

    if (t.isJSXElement(node)) {
      catalogJsxElement(node);
    }

    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const child of value) {
          if (t.isNode(child)) {
            walkWithOwners(child);
          }
        }
      } else if (t.isNode(value)) {
        walkWithOwners(value);
      }
    }
  };

  try {
    walkWithOwners(ast);
  } catch {
    result.parseWarning = true;
  }

  result.elements.sort((left, right) => {
    const uriOrder = left.uri.localeCompare(right.uri);
    if (uriOrder !== 0) {
      return uriOrder;
    }
    const lineOrder = left.region.start.line - right.region.start.line;
    if (lineOrder !== 0) {
      return lineOrder;
    }
    const columnOrder = (left.region.start.column ?? 0) - (right.region.start.column ?? 0);
    if (columnOrder !== 0) {
      return columnOrder;
    }
    const kindOrder = left.elementKind.localeCompare(right.elementKind);
    if (kindOrder !== 0) {
      return kindOrder;
    }
    const leftName = left.tagName ?? left.componentName ?? "";
    const rightName = right.tagName ?? right.componentName ?? "";
    return leftName.localeCompare(rightName);
  });

  return result;
}

export function fileContainsJsx(source: string, uri: string): boolean {
  try {
    const ast = parse(source, {
      sourceType: "unambiguous",
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: parserPlugins(uri),
      errorRecovery: true,
      ranges: false,
      tokens: false,
      attachComment: false,
    });
    let found = false;
    visitAst(ast, (node) => {
      if (t.isJSXElement(node) || t.isJSXFragment(node)) {
        found = true;
      }
    });
    return found;
  } catch {
    return false;
  }
}
