import type { SkippedRoutePattern } from "@a11yst/types";

/** App Router page file extensions. */
export const APP_PAGE_EXTENSIONS = ["tsx", "jsx", "ts", "js"] as const;

/** Basenames that are never routable App Router pages. */
export const APP_SPECIAL_BASENAMES = new Set([
  "layout",
  "loading",
  "error",
  "not-found",
  "template",
  "default",
  "route",
  "global-error",
]);

/** Pages Router files and directories that are never public routes. */
export const PAGES_ROUTER_EXCLUDED = new Set([
  "_app",
  "_document",
  "_error",
  "_middleware",
  "api",
]);

export type NextRouteSegment =
  | { kind: "static"; value: string }
  | { kind: "dynamic"; param: string; optional: boolean; catchAll: boolean }
  | { kind: "group"; value: string }
  | { kind: "parallel"; slot: string };

export interface ParsedNextRoute {
  path: string;
  pattern: string;
  hasDynamic: boolean;
  sourceFile?: string;
}

export function parseNextSegment(segment: string): NextRouteSegment {
  if (segment.startsWith("(") && segment.endsWith(")")) {
    return { kind: "group", value: segment.slice(1, -1) };
  }
  if (segment.startsWith("@")) {
    return { kind: "parallel", slot: segment.slice(1) };
  }
  if (segment.startsWith("[[...") && segment.endsWith("]]")) {
    const param = segment.slice(5, -2);
    return { kind: "dynamic", param, optional: true, catchAll: true };
  }
  if (segment.startsWith("[...") && segment.endsWith("]")) {
    const param = segment.slice(4, -1);
    return { kind: "dynamic", param, optional: false, catchAll: true };
  }
  if (segment.startsWith("[") && segment.endsWith("]")) {
    const param = segment.slice(1, -1);
    return { kind: "dynamic", param, optional: false, catchAll: false };
  }
  return { kind: "static", value: segment };
}

export function segmentsToRoutePath(segments: readonly NextRouteSegment[]): ParsedNextRoute | undefined {
  const urlParts: string[] = [];
  const patternParts: string[] = [];
  let hasDynamic = false;

  for (const segment of segments) {
    switch (segment.kind) {
      case "group":
      case "parallel":
        continue;
      case "static":
        urlParts.push(segment.value);
        patternParts.push(segment.value);
        break;
      case "dynamic":
        hasDynamic = true;
        if (segment.catchAll) {
          patternParts.push(segment.optional ? `:...${segment.param}?` : `:...${segment.param}`);
        } else {
          patternParts.push(`:${segment.param}`);
        }
        break;
    }
  }

  const path = urlParts.length === 0 ? "/" : `/${urlParts.join("/")}`;
  const pattern = patternParts.length === 0 ? "/" : `/${patternParts.join("/")}`;
  return { path, pattern, hasDynamic };
}

export function isAppRouterPageFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const match = normalized.match(/^(?:src\/)?app\/(.+)\/page\.(tsx|jsx|ts|js)$/);
  if (!match) {
    return normalized === "app/page.tsx" ||
      normalized === "app/page.jsx" ||
      normalized === "app/page.ts" ||
      normalized === "app/page.js" ||
      normalized === "src/app/page.tsx" ||
      normalized === "src/app/page.jsx" ||
      normalized === "src/app/page.ts" ||
      normalized === "src/app/page.js";
  }
  const basename = normalized.split("/").at(-2);
  return basename !== undefined && !APP_SPECIAL_BASENAMES.has(basename);
}

export function appRouterRelativePathToRoute(relativePath: string): ParsedNextRoute | undefined {
  const normalized = relativePath.replace(/\\/g, "/");
  const prefixMatch = normalized.match(/^(?:src\/)?app\/(.+)\/page\.(tsx|jsx|ts|js)$/);
  if (!prefixMatch?.[1]) {
    if (/^(?:src\/)?app\/page\.(tsx|jsx|ts|js)$/.test(normalized)) {
      return { path: "/", pattern: "/", hasDynamic: false, sourceFile: normalized };
    }
    return undefined;
  }

  const segmentNames = prefixMatch[1].split("/");
  const segments = segmentNames.map(parseNextSegment);
  const route = segmentsToRoutePath(segments);
  return route ? { ...route, sourceFile: normalized } : undefined;
}

export function isPagesRouterPageFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const match = normalized.match(/^(?:src\/)?pages\/(.+)\.(tsx|jsx|ts|js)$/);
  if (!match?.[1]) {
    return /^(?:src\/)?pages\/index\.(tsx|jsx|ts|js)$/.test(normalized);
  }

  const parts = match[1].split("/");
  return !parts.some((part) => PAGES_ROUTER_EXCLUDED.has(part));
}

export function pagesRouterRelativePathToRoute(relativePath: string): ParsedNextRoute | undefined {
  const normalized = relativePath.replace(/\\/g, "/");
  const match = normalized.match(/^(?:src\/)?pages\/(.+)\.(tsx|jsx|ts|js)$/);
  if (!match?.[1]) {
    if (/^(?:src\/)?pages\/index\.(tsx|jsx|ts|js)$/.test(normalized)) {
      return { path: "/", pattern: "/", hasDynamic: false, sourceFile: normalized };
    }
    return undefined;
  }

  const parts = match[1].split("/");
  if (parts.some((part) => PAGES_ROUTER_EXCLUDED.has(part))) {
    return undefined;
  }

  const baseName = parts.at(-1) ?? "";
  const dirParts = parts.slice(0, -1);
  const segments = [...dirParts, baseName === "index" ? "" : baseName]
    .filter(Boolean)
    .map(parseNextSegment);
  const route = segmentsToRoutePath(segments);
  return route ? { ...route, sourceFile: normalized } : undefined;
}

export interface NextDiscoveryOptions {
  relativePaths: readonly string[];
}

export interface NextDiscoveryOutput {
  appRoutes: ParsedNextRoute[];
  pagesRoutes: ParsedNextRoute[];
  skippedPatterns: SkippedRoutePattern[];
}

export function discoverNextRoutesFromPaths(
  options: NextDiscoveryOptions,
): NextDiscoveryOutput {
  const appRoutes: ParsedNextRoute[] = [];
  const pagesRoutes: ParsedNextRoute[] = [];
  const skippedByPattern = new Map<string, SkippedRoutePattern>();

  for (const relativePath of options.relativePaths) {
    if (isAppRouterPageFile(relativePath)) {
      const route = appRouterRelativePathToRoute(relativePath);
      if (route) {
        if (route.hasDynamic) {
          skippedByPattern.set(route.pattern, {
            pattern: route.pattern,
            reason: "dynamic-segment",
            sourceFile: route.sourceFile,
          });
        } else {
          appRoutes.push(route);
        }
      }
      continue;
    }

    if (isPagesRouterPageFile(relativePath)) {
      const route = pagesRouterRelativePathToRoute(relativePath);
      if (route) {
        if (route.hasDynamic) {
          skippedByPattern.set(route.pattern, {
            pattern: route.pattern,
            reason: "dynamic-segment",
            sourceFile: route.sourceFile,
          });
        } else {
          pagesRoutes.push(route);
        }
      }
    }
  }

  return {
    appRoutes: dedupeParsedRoutes(appRoutes),
    pagesRoutes: dedupeParsedRoutes(pagesRoutes),
    skippedPatterns: [...skippedByPattern.values()].sort((a, b) =>
      a.pattern.localeCompare(b.pattern),
    ),
  };
}

function dedupeParsedRoutes(routes: ParsedNextRoute[]): ParsedNextRoute[] {
  const seen = new Set<string>();
  const result: ParsedNextRoute[] = [];
  for (const route of routes.sort((a, b) => a.path.localeCompare(b.path))) {
    if (seen.has(route.path)) {
      continue;
    }
    seen.add(route.path);
    result.push(route);
  }
  return result;
}

export function mergeAppAndPagesRoutes(
  appRoutes: ParsedNextRoute[],
  pagesRoutes: ParsedNextRoute[],
): {
  routes: ParsedNextRoute[];
  collisions: string[];
} {
  const byPath = new Map<string, ParsedNextRoute>();
  const collisions: string[] = [];

  for (const route of appRoutes) {
    byPath.set(route.path, route);
  }
  for (const route of pagesRoutes) {
    if (byPath.has(route.path)) {
      collisions.push(route.path);
    }
    byPath.set(route.path, route);
  }

  return {
    routes: [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
    collisions: collisions.sort(),
  };
}
