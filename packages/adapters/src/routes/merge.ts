import type { Diagnostic, DiscoveredRoute, NormalizedRoute, SkippedRoutePattern } from "@a11yst/types";
import type {
  ResolveProjectRoutesInput,
  ResolveProjectRoutesResult,
} from "../types.js";
import { applyDynamicSamples } from "./dynamic-samples.js";

function routeKey(route: { path: string }): string {
  return route.path;
}

function toNormalized(route: DiscoveredRoute | NormalizedRoute): NormalizedRoute {
  return {
    id: route.id,
    name: route.name,
    path: route.path,
    ...(route.origin !== undefined ? { origin: route.origin } : {}),
    ...(route.pattern !== undefined ? { pattern: route.pattern } : {}),
    ...(route.sourceFile !== undefined ? { sourceFile: route.sourceFile } : {}),
    ...(route.sourceLine !== undefined ? { sourceLine: route.sourceLine } : {}),
  };
}

function isAdapterDiscoveredOrigin(origin: DiscoveredRoute["origin"]): boolean {
  return (
    origin === "filesystem" ||
    origin === "react-jsx-route" ||
    origin === "react-router-object"
  );
}

/**
 * Merge explicit config routes with adapter discovery.
 *
 * Precedence (highest first): explicit > dynamic-sample > filesystem/react-router > adapter-default.
 * Explicit routes are never removed. In `merge` mode, lower-precedence routes
 * with the same path are dropped. In `fallback` mode, discovery is ignored when
 * explicit routes exist. In `off` mode, only explicit routes are returned.
 */
export function resolveProjectRoutes(
  input: ResolveProjectRoutesInput,
): ResolveProjectRoutesResult {
  const diagnostics: Diagnostic[] = [...input.discovery.diagnostics];
  let skippedPatterns: SkippedRoutePattern[] = [
    ...input.discovery.skippedPatterns,
  ];

  if (input.mode === "off") {
    return {
      routes: input.explicitRoutes.map((route) => ({ ...route })),
      skippedPatterns,
      diagnostics,
    };
  }

  const sampleExpansion = applyDynamicSamples({
    skippedPatterns,
    samples: input.samples,
  });
  diagnostics.push(...sampleExpansion.diagnostics);
  skippedPatterns = sampleExpansion.skippedPatterns;

  const tiers: DiscoveredRoute[][] = [
    input.explicitRoutes.map((route) => ({
      ...route,
      origin: "explicit" as const,
      dynamic: false,
    })),
    sampleExpansion.routes,
    input.discovery.routes.filter((route) => isAdapterDiscoveredOrigin(route.origin)),
    input.discovery.routes.filter((route) => route.origin === "adapter-default"),
  ];

  if (input.mode === "fallback" && input.explicitRoutes.length > 0) {
    return {
      routes: input.explicitRoutes.map((route) => ({ ...route })),
      skippedPatterns,
      diagnostics,
    };
  }

  const merged = new Map<string, NormalizedRoute>();
  for (const tier of tiers) {
    for (const route of tier) {
      const key = routeKey(route);
      if (!merged.has(key)) {
        merged.set(key, toNormalized(route));
      }
    }
  }

  if (input.mode === "merge") {
    if (input.explicitRoutes.length > 0) {
      const explicitPaths = new Set(input.explicitRoutes.map((route) => route.path));
      const additional: NormalizedRoute[] = [];
      const appendTier = (tier: DiscoveredRoute[]): void => {
        for (const route of tier) {
          if (explicitPaths.has(route.path)) {
            continue;
          }
          if (additional.some((existing) => existing.path === route.path)) {
            continue;
          }
          additional.push(toNormalized(route));
        }
      };

      appendTier(input.discovery.routes.filter((route) => isAdapterDiscoveredOrigin(route.origin)));
      appendTier(input.discovery.routes.filter((route) => route.origin === "adapter-default"));
      appendTier(sampleExpansion.routes);

      return {
        routes: [...input.explicitRoutes.map((route) => ({ ...route })), ...additional],
        skippedPatterns,
        diagnostics,
      };
    }

    return {
      routes: [...merged.values()],
      skippedPatterns,
      diagnostics,
    };
  }

  return {
    routes: [...merged.values()],
    skippedPatterns,
    diagnostics,
  };
}

export { emptyDiscovery } from "../shared.js";
