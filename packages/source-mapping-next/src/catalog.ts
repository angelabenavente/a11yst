import type {
  NextRouteCatalog,
  NextRouteEntry,
  NextRouterKind,
  NextSourceDiagnostic,
} from "@a11yst/types";
import { createNextDiagnostic, omitUndefinedDeep, sortNextDiagnostics } from "./diagnostics.js";
import { NextSourceValidationError } from "./errors.js";
import { buildNextCatalogFromIndex } from "./build-catalog.js";
import { resolveNextCatalogOptions, sortStringArray } from "./sanitize.js";
import {
  compareRouteSpecificity,
  matchPathToPattern,
  pathSegmentsFromRoute,
  routeSpecificity,
} from "./route-matching.js";
import type { ReactSourceCatalog, SourceIndexResult } from "@a11yst/types";

export type CreateNextRouteCatalogInput = {
  sourceIndex: SourceIndexResult;
  reactCatalog: ReactSourceCatalog;
  scopeIds?: string[];
  options?: { maxRoutes?: number; maxFilesPerRoute?: number };
};

export function createNextRouteCatalog(input: CreateNextRouteCatalogInput): NextRouteCatalog {
  let options;
  try {
    options = resolveNextCatalogOptions(input.options);
  } catch (error) {
    if (error instanceof NextSourceValidationError) {
      return omitUndefinedDeep({
        version: 1 as const,
        status: "invalid",
        routes: [],
        files: [],
        diagnostics: [
          createNextDiagnostic("invalid-next-mapping-evidence", "error", error.message),
        ],
        summary: emptySummary(),
      });
    }
    throw error;
  }

  const diagnostics: NextSourceDiagnostic[] = [];
  const scopeIds =
    input.scopeIds !== undefined && input.scopeIds.length > 0
      ? sortStringArray(input.scopeIds)
      : undefined;

  if (scopeIds !== undefined) {
    const knownScopes = new Set<string>();
    for (const file of input.sourceIndex.files) {
      for (const scopeId of file.scopeIds) {
        knownScopes.add(scopeId);
      }
    }
    for (const scopeId of scopeIds) {
      if (!knownScopes.has(scopeId)) {
        diagnostics.push(
          createNextDiagnostic("unknown-next-scope", "warning", "Requested Next.js scope is unknown", {
            scopeId,
          }),
        );
      }
    }
  }

  const built = buildNextCatalogFromIndex({
    files: input.sourceIndex.files,
    reactCatalog: input.reactCatalog,
    scopeIds,
  });

  diagnostics.push(...built.diagnostics);

  if (built.summary.appRouterRoots > 0) {
    diagnostics.push(
      createNextDiagnostic("next-app-router-root-found", "info", "App Router root detected"),
    );
  }
  if (built.summary.pagesRouterRoots > 0) {
    diagnostics.push(
      createNextDiagnostic("next-pages-router-root-found", "info", "Pages Router root detected"),
    );
  }

  let routes = built.routes;
  let status: NextRouteCatalog["status"] = "complete";

  if (routes.length > options.maxRoutes) {
    routes = routes.slice(0, options.maxRoutes);
    status = "partial";
    diagnostics.push(createNextDiagnostic("next-route-limit-reached", "warning", "Route limit reached"));
  }

  for (const route of routes) {
    const associationCount =
      route.pageUris.length +
      route.layoutUris.length +
      route.templateUris.length +
      route.sharedUris.length +
      Object.values(route.stateUris).reduce((total, uris) => total + (uris?.length ?? 0), 0);
    if (associationCount > options.maxFilesPerRoute) {
      status = "partial";
      diagnostics.push(
        createNextDiagnostic(
          "next-route-file-limit-reached",
          "warning",
          "Route file association limit reached",
          { routePattern: route.routePattern },
        ),
      );
    }
  }

  if (diagnostics.some((diagnostic) => diagnostic.level !== "info")) {
    status = status === "complete" ? "partial" : status;
  }

  return omitUndefinedDeep({
    version: 1 as const,
    status,
    routes,
    files: built.files,
    diagnostics: sortNextDiagnostics(diagnostics),
    summary: built.summary,
  });
}

function emptySummary(): NextRouteCatalog["summary"] {
  return {
    scopes: 0,
    appRouterRoots: 0,
    pagesRouterRoots: 0,
    routes: 0,
    staticRoutes: 0,
    dynamicRoutes: 0,
    catchAllRoutes: 0,
    routeGroups: 0,
    parallelRoutes: 0,
    interceptingRoutesSkipped: 0,
    apiRoutesSkipped: 0,
    routeHandlersSkipped: 0,
  };
}

export type RouteResolutionResult =
  | { ok: true; routes: NextRouteEntry[]; router: NextRouterKind | "both" }
  | {
      ok: false;
      reason: "not-matched" | "ambiguous" | "unsafe" | "unknown-scope";
      diagnostics: NextSourceDiagnostic[];
    };

export function resolveRoutesForPath(input: {
  catalog: NextRouteCatalog;
  normalizedRoute: string;
  routerHint?: NextRouterKind;
  scopeIds?: string[];
}): RouteResolutionResult {
  const diagnostics: NextSourceDiagnostic[] = [];
  const scopeFilter =
    input.scopeIds !== undefined && input.scopeIds.length > 0
      ? new Set(sortStringArray(input.scopeIds))
      : undefined;

  const candidates = input.catalog.routes.filter((route) => {
    if (scopeFilter && !route.scopeIds.some((scopeId) => scopeFilter.has(scopeId))) {
      return false;
    }
    if (input.routerHint && route.router !== input.routerHint) {
      return false;
    }
    return true;
  });

  const pathSegments = pathSegmentsFromRoute(input.normalizedRoute);
  const matched = candidates.filter((route) =>
    matchPathToPattern(pathSegments, route.segments),
  );

  if (matched.length === 0) {
    return {
      ok: false,
      reason: "not-matched",
      diagnostics: [
        createNextDiagnostic("next-route-not-matched", "info", "Route did not match Next.js catalog"),
      ],
    };
  }

  matched.sort((left, right) => {
    const specificity = compareRouteSpecificity(
      routeSpecificity(right.segments),
      routeSpecificity(left.segments),
    );
    if (specificity !== 0) {
      return specificity;
    }
    const scopeOrder = left.scopeIds.join(",").localeCompare(right.scopeIds.join(","));
    if (scopeOrder !== 0) {
      return scopeOrder;
    }
    return left.router.localeCompare(right.router);
  });

  const best = routeSpecificity(matched[0]!.segments);
  const topTier = matched.filter(
    (route) => compareRouteSpecificity(routeSpecificity(route.segments), best) === 0,
  );

  const distinctKeys = new Set(
    topTier.map((route) => `${route.scopeIds.join(",")}\0${route.router}\0${route.routePattern}`),
  );

  if (distinctKeys.size > 1) {
    diagnostics.push(
      createNextDiagnostic(
        "next-route-ambiguous",
        "info",
        "Multiple Next.js route patterns matched the path",
      ),
    );
    if (!input.routerHint && new Set(topTier.map((route) => route.router)).size > 1) {
      diagnostics.push(
        createNextDiagnostic(
          "next-route-pattern-conflict",
          "info",
          "App Router and Pages Router both matched the route",
        ),
      );
    }
    return { ok: false, reason: "ambiguous", diagnostics };
  }

  const router =
    input.routerHint ??
    (new Set(topTier.map((route) => route.router)).size === 1
      ? topTier[0]!.router
      : ("both" as const));

  return { ok: true, routes: topTier, router };
}
