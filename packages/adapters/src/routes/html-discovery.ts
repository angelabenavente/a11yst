import type { RouteDiscoveryResult } from "@a11yst/types";
import { walkFiles } from "../utils/fs-walk.js";
import { makeDiscoveredRoute } from "../utils/routes.js";

/**
 * HTML route discovery policy:
 *
 * - Walk the project root for `.html` files (limited depth, excluding build/vendor dirs).
 * - `index.html` at the walk root maps to `/`.
 * - `about.html` maps to `/about.html` (flat file routes keep the extension).
 * - `about/index.html` maps to `/about/` (directory index routes use a trailing slash).
 * - Nested paths mirror the directory structure (e.g. `docs/guide/index.html` → `/docs/guide/`).
 */
export function htmlRelativePathToRoute(relativePath: string): string | undefined {
  if (!relativePath.endsWith(".html")) {
    return undefined;
  }

  const withoutExt = relativePath.slice(0, -".html".length);
  if (withoutExt === "index") {
    return "/";
  }
  if (withoutExt.endsWith("/index")) {
    return `/${withoutExt.slice(0, -"/index".length)}/`;
  }
  return `/${relativePath}`;
}

export function discoverHtmlRoutes(projectRoot: string): RouteDiscoveryResult {
  const entries = walkFiles(projectRoot, { maxDepth: 6 });
  const routes = entries
    .filter((entry) => !entry.isDirectory && entry.relativePath.endsWith(".html"))
    .map((entry) => {
      const path = htmlRelativePathToRoute(entry.relativePath);
      if (!path) {
        return undefined;
      }
      return makeDiscoveredRoute(path, "filesystem", {
        sourceFile: entry.relativePath,
      });
    })
    .filter((route): route is NonNullable<typeof route> => route !== undefined)
    .sort((a, b) => a.path.localeCompare(b.path));

  const seen = new Set<string>();
  const deduped = routes.filter((route) => {
    if (seen.has(route.path)) {
      return false;
    }
    seen.add(route.path);
    return true;
  });

  return { routes: deduped, skippedPatterns: [], diagnostics: [] };
}
