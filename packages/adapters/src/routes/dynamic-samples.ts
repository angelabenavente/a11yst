import type { Diagnostic, SkippedRoutePattern } from "@a11yst/types";
import type { RouteSamplesConfig } from "../types.js";
import { makeDiscoveredRoute } from "../utils/routes.js";

export interface ApplyDynamicSamplesInput {
  skippedPatterns: readonly SkippedRoutePattern[];
  samples?: RouteSamplesConfig;
}

export interface ApplyDynamicSamplesResult {
  routes: ReturnType<typeof makeDiscoveredRoute>[];
  skippedPatterns: SkippedRoutePattern[];
  diagnostics: Diagnostic[];
}

/**
 * Expand dynamic route patterns using configured sample values.
 * Invalid sample paths produce diagnostics and are skipped.
 */
export function applyDynamicSamples(
  input: ApplyDynamicSamplesInput,
): ApplyDynamicSamplesResult {
  const patterns = input.samples ?? {};
  const routes: ReturnType<typeof makeDiscoveredRoute>[] = [];
  const stillSkipped: SkippedRoutePattern[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const skipped of input.skippedPatterns) {
    const samplePaths = patterns[skipped.pattern];
    if (!samplePaths || samplePaths.length === 0) {
      stillSkipped.push(skipped);
      continue;
    }

    for (const samplePath of samplePaths) {
      if (!samplePath.startsWith("/")) {
        diagnostics.push({
          code: "ROUTE_SAMPLE_INVALID",
          severity: "warning",
          message: `Sample path "${samplePath}" for pattern "${skipped.pattern}" must start with "/".`,
        });
        continue;
      }
      routes.push(
        makeDiscoveredRoute(samplePath, "dynamic-sample", {
          pattern: skipped.pattern,
          dynamic: true,
        }),
      );
    }
  }

  const seen = new Set<string>();
  const deduped = routes.filter((route) => {
    if (seen.has(route.path)) {
      return false;
    }
    seen.add(route.path);
    return true;
  });

  return {
    routes: deduped,
    skippedPatterns: stillSkipped,
    diagnostics,
  };
}
