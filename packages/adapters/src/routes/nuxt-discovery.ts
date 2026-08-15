import type { SkippedRoutePattern } from "@a11yst/types";
import type { ParsedNextRoute } from "./next-discovery.js";
import { parseNextSegment, segmentsToRoutePath } from "./next-discovery.js";

/** Nuxt directories under pages/ that never define routes. */
export const NUXT_EXCLUDED_PAGE_DIRS = new Set([
  "components",
  "layouts",
  "middleware",
  "server",
]);

export function isNuxtPageFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const match = normalized.match(/^pages\/(.+)\.vue$/);
  if (!match?.[1]) {
    return normalized === "pages/index.vue";
  }

  const parts = match[1].split("/");
  return !parts.some((part) => NUXT_EXCLUDED_PAGE_DIRS.has(part));
}

export function nuxtRelativePathToRoute(relativePath: string): ParsedNextRoute | undefined {
  const normalized = relativePath.replace(/\\/g, "/");
  const match = normalized.match(/^pages\/(.+)\.vue$/);
  if (!match?.[1]) {
    if (normalized === "pages/index.vue") {
      return { path: "/", pattern: "/", hasDynamic: false, sourceFile: normalized };
    }
    return undefined;
  }

  const parts = match[1].split("/");
  if (parts.some((part) => NUXT_EXCLUDED_PAGE_DIRS.has(part))) {
    return undefined;
  }

  const baseName = parts.at(-1) ?? "";
  const dirParts = parts.slice(0, -1);
  const segmentNames =
    baseName === "index" ? dirParts : [...dirParts, baseName];
  const segments = segmentNames.map(parseNextSegment);
  const route = segmentsToRoutePath(segments);
  return route ? { ...route, sourceFile: normalized } : undefined;
}

export function discoverNuxtRoutesFromPaths(relativePaths: readonly string[]): {
  routes: ParsedNextRoute[];
  skippedPatterns: SkippedRoutePattern[];
} {
  const routes: ParsedNextRoute[] = [];
  const skippedByPattern = new Map<string, SkippedRoutePattern>();

  for (const relativePath of relativePaths) {
    if (!isNuxtPageFile(relativePath)) {
      continue;
    }
    const route = nuxtRelativePathToRoute(relativePath);
    if (!route) {
      continue;
    }
    if (route.hasDynamic) {
      skippedByPattern.set(route.pattern, {
        pattern: route.pattern,
        reason: "dynamic-segment",
        sourceFile: route.sourceFile,
      });
    } else {
      routes.push(route);
    }
  }

  const seen = new Set<string>();
  const deduped = routes
    .sort((a, b) => a.path.localeCompare(b.path))
    .filter((route) => {
      if (seen.has(route.path)) {
        return false;
      }
      seen.add(route.path);
      return true;
    });

  return {
    routes: deduped,
    skippedPatterns: [...skippedByPattern.values()].sort((a, b) =>
      a.pattern.localeCompare(b.pattern),
    ),
  };
}
