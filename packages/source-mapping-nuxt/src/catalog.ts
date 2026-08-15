import type {
  NuxtRouteCatalog,
  NuxtRouteCatalogOptions,
  NuxtRouteEntry,
  SourceIndexResult,
  VueSourceCatalog,
} from "@a11yst/types";
import { buildNuxtRouteCatalog } from "./build-catalog.js";
import { createNuxtDiagnostic, omitUndefinedDeep, sortNuxtDiagnostics } from "./diagnostics.js";
import { NuxtSourceValidationError } from "./errors.js";
import { resolveNuxtCatalogOptions, sortStringArray } from "./sanitize.js";
import {
  compareRouteSpecificity,
  matchPathToPattern,
  pathSegmentsFromRoute,
  routeSpecificity,
} from "./route-matching.js";
import { normalizeNuxtRoutePath } from "./sanitize.js";

export type CreateNuxtRouteCatalogInput = {
  sourceIndex: SourceIndexResult;
  vueCatalog: VueSourceCatalog;
  scopeIds?: string[];
  options?: NuxtRouteCatalogOptions;
};

export type RouteResolutionResult =
  | { status: "matched"; routes: NuxtRouteEntry[] }
  | { status: "not-matched" }
  | { status: "ambiguous"; routes: NuxtRouteEntry[] };

function filterScopedFiles(
  sourceIndex: SourceIndexResult,
  scopeIds: string[] | undefined,
): { files: SourceIndexResult["files"]; unknownScopes: string[] } {
  if (scopeIds === undefined || scopeIds.length === 0) {
    return { files: [...sourceIndex.files], unknownScopes: [] };
  }

  const requested = sortStringArray(scopeIds);
  const known = new Set<string>();
  for (const file of sourceIndex.files) {
    for (const scopeId of file.scopeIds) {
      known.add(scopeId);
    }
  }
  const unknownScopes = requested.filter((scopeId) => !known.has(scopeId));
  const files = sourceIndex.files.filter((file) =>
    requested.some((scopeId) => file.scopeIds.includes(scopeId)),
  );
  return { files, unknownScopes };
}

export function createNuxtRouteCatalog(input: CreateNuxtRouteCatalogInput): NuxtRouteCatalog {
  let options;
  try {
    options = resolveNuxtCatalogOptions(input.options);
  } catch (error) {
    if (error instanceof NuxtSourceValidationError) {
      return omitUndefinedDeep({
        version: 1 as const,
        status: "invalid",
        routes: [],
        files: [],
        diagnostics: [createNuxtDiagnostic("invalid-nuxt-mapping-evidence", "error")],
        summary: {
          scopes: 0,
          nuxt3PageRoots: 0,
          nuxt4PageRoots: 0,
          routes: 0,
          staticRoutes: 0,
          dynamicRoutes: 0,
          optionalRoutes: 0,
          catchAllRoutes: 0,
          routeGroups: 0,
          nestedRoutes: 0,
          unsupportedPageFiles: 0,
        },
      }) as NuxtRouteCatalog;
    }
    throw error;
  }

  const filtered = filterScopedFiles(input.sourceIndex, input.scopeIds);
  const built = buildNuxtRouteCatalog({
    scopedFiles: filtered.files,
    vueCatalog: input.vueCatalog,
    maxRoutes: options.maxRoutes,
  });

  const diagnostics = [...built.diagnostics];
  for (const scopeId of filtered.unknownScopes) {
    diagnostics.push(createNuxtDiagnostic("unknown-nuxt-scope", "warning", undefined, { scopeId }));
  }

  return omitUndefinedDeep({
    version: 1 as const,
    status: built.status,
    routes: built.routes,
    files: built.files,
    diagnostics: sortNuxtDiagnostics(diagnostics),
    summary: built.summary,
  }) as NuxtRouteCatalog;
}

export function resolveRoutesForPath(input: {
  routeCatalog: NuxtRouteCatalog;
  normalizedPath: string;
  scopeIds?: string[];
}): RouteResolutionResult {
  const pathSegments = pathSegmentsFromRoute(input.normalizedPath);
  const matched = input.routeCatalog.routes.filter((route) => {
    if (input.scopeIds !== undefined && input.scopeIds.length > 0) {
      if (!input.scopeIds.some((scopeId) => route.scopeIds.includes(scopeId))) {
        return false;
      }
    }
    return matchPathToPattern(pathSegments, route.segments);
  });

  if (matched.length === 0) {
    return { status: "not-matched" };
  }

  matched.sort((left, right) => {
    const specificity = compareRouteSpecificity(
      routeSpecificity(right.segments),
      routeSpecificity(left.segments),
    );
    if (specificity !== 0) {
      return specificity;
    }
    return (left.scopeIds[0] ?? "").localeCompare(right.scopeIds[0] ?? "");
  });

  const best = routeSpecificity(matched[0]!.segments);
  const bestMatches = matched.filter(
    (route) => compareRouteSpecificity(routeSpecificity(route.segments), best) === 0,
  );

  const distinctPatterns = new Set(bestMatches.map((route) => `${route.scopeIds.join(",")}\0${route.routePattern}`));
  if (distinctPatterns.size > 1) {
    return { status: "ambiguous", routes: bestMatches };
  }

  const materialDistinct = new Set(
    bestMatches.map((route) =>
      JSON.stringify({
        pageUris: route.pageUris,
        parentPageUris: route.parentPageUris,
        sharedUris: route.sharedUris,
        layoutUris: route.layoutUris,
      }),
    ),
  );
  if (materialDistinct.size > 1) {
    return { status: "ambiguous", routes: bestMatches };
  }

  return { status: "matched", routes: bestMatches };
}

export { normalizeNuxtRoutePath };
