import type {
  IndexedSourceFile,
  NuxtModuleBoundary,
  NuxtRouteEntry,
  NuxtRouteFile,
  NuxtRouteSegment,
  NuxtSourceDiagnostic,
  NuxtRouteCatalogSummary,
  VueSourceCatalog,
} from "@a11yst/types";
import {
  APP_SHELL_BASENAMES,
  ERROR_BASENAMES,
  UNSUPPORTED_PAGE_EXTENSIONS,
} from "./constants.js";
import { createNuxtDiagnostic } from "./diagnostics.js";
import {
  basename,
  dirname,
  isNuxtScopeFile,
  sortStringArray,
  stripBoundarySuffix,
} from "./sanitize.js";
import {
  findNuxt3PageRootIndex,
  findNuxt4PageRootIndex,
  layoutNameFromUri,
  parseDirectorySegments,
  parseUrlSegment,
  segmentsToRoutePattern,
} from "./route-segments.js";

type BuildContext = {
  diagnostics: NuxtSourceDiagnostic[];
  summary: {
    nuxt3PageRoots: Set<string>;
    nuxt4PageRoots: Set<string>;
    routeGroups: Set<string>;
    nestedRoutes: number;
    unsupportedPageFiles: number;
  };
  vueCatalog: VueSourceCatalog;
  routeFiles: Map<string, NuxtRouteFile>;
};

function hasNuxtPageOutlet(vueCatalog: VueSourceCatalog, uri: string): boolean {
  const file = vueCatalog.files.find((entry) => entry.uri === uri);
  if (!file) {
    return false;
  }
  return file.elements.some(
    (element) =>
      element.elementKind === "component" &&
      element.componentName?.toLowerCase() === "nuxtpage",
  );
}

function moduleBoundaryForUri(uri: string): NuxtModuleBoundary {
  if (uri.includes(".client.vue")) {
    return "client";
  }
  if (uri.includes(".server.vue")) {
    return "server";
  }
  return "unknown";
}

function registerRouteFile(
  context: BuildContext,
  file: NuxtRouteFile,
): void {
  const existing = context.routeFiles.get(file.uri);
  if (!existing) {
    context.routeFiles.set(file.uri, file);
    return;
  }
  context.routeFiles.set(file.uri, {
    ...existing,
    scopeIds: sortStringArray([...existing.scopeIds, ...file.scopeIds]),
    projectNames: sortStringArray([
      ...(existing.projectNames ?? []),
      ...(file.projectNames ?? []),
    ]),
  });
}

function pageRouteFromRelativeParts(relativeParts: string[], fileName: string): {
  segments: NuxtRouteSegment[];
  routePattern: string;
  routeGroupNames: string[];
} {
  const { routeSegments, routeGroupNames } = parseDirectorySegments(relativeParts);
  const { base } = stripBoundarySuffix(fileName);
  const pageBase = base.replace(/\.vue$/, "");
  if (pageBase !== "index") {
    const parsed = parseUrlSegment(pageBase);
    if (parsed) {
      routeSegments.push(parsed);
    }
  }
  return {
    segments: routeSegments,
    routePattern: segmentsToRoutePattern(routeSegments),
    routeGroupNames,
  };
}

function buildRoutesForScope(
  scopedFiles: IndexedSourceFile[],
  context: BuildContext,
  scopeId: string,
): NuxtRouteEntry[] {
  const routes: NuxtRouteEntry[] = [];
  const appShellUris: string[] = [];
  const defaultLayoutUris: string[] = [];
  const namedLayouts = new Map<string, string>();
  const errorUris: string[] = [];
  const pageFiles: { uri: string; routePattern: string; segments: NuxtRouteSegment[]; routeGroupNames: string[] }[] = [];

  for (const file of scopedFiles) {
    const parts = file.uri.split("/");
    const nuxt4Root = findNuxt4PageRootIndex(parts);
    const nuxt3Root = findNuxt3PageRootIndex(parts);

    if (nuxt4Root !== undefined) {
      context.summary.nuxt4PageRoots.add(`${scopeId}:${parts.slice(0, nuxt4Root + 2).join("/")}`);
    }
    if (nuxt3Root !== undefined && nuxt4Root === undefined) {
      context.summary.nuxt3PageRoots.add(`${scopeId}:${parts.slice(0, nuxt3Root + 1).join("/")}`);
    }

    const base = basename(file.uri);
    if (APP_SHELL_BASENAMES.has(base) && !file.uri.includes("/pages/")) {
      appShellUris.push(file.uri);
      registerRouteFile(context, {
        uri: file.uri,
        role: "app-shell",
        scopeIds: [scopeId],
        projectNames: file.projectNames,
        moduleBoundary: moduleBoundaryForUri(file.uri),
      });
      continue;
    }

    if (ERROR_BASENAMES.has(base) && !file.uri.includes("/pages/")) {
      errorUris.push(file.uri);
      registerRouteFile(context, {
        uri: file.uri,
        role: "error",
        scopeIds: [scopeId],
        projectNames: file.projectNames,
        moduleBoundary: moduleBoundaryForUri(file.uri),
      });
      continue;
    }

    if (file.uri.includes("/layouts/") && file.kind === "vue") {
      const layoutName = layoutNameFromUri(file.uri);
      if (layoutName) {
        namedLayouts.set(layoutName, file.uri);
        registerRouteFile(context, {
          uri: file.uri,
          role: "layout",
          scopeIds: [scopeId],
          projectNames: file.projectNames,
          moduleBoundary: moduleBoundaryForUri(file.uri),
          layoutName,
        });
        if (layoutName === "default") {
          defaultLayoutUris.push(file.uri);
        }
      }
      continue;
    }

    const extension = file.extension ?? "";
    if (
      (nuxt4Root !== undefined || nuxt3Root !== undefined) &&
      UNSUPPORTED_PAGE_EXTENSIONS.has(extension) &&
      !file.uri.includes("/layouts/")
    ) {
      context.summary.unsupportedPageFiles += 1;
      continue;
    }

    if (file.kind !== "vue") {
      continue;
    }

    const pagesRootIndex = nuxt4Root !== undefined ? nuxt4Root + 1 : nuxt3Root;
    if (pagesRootIndex === undefined) {
      continue;
    }

    const relativeParts = parts.slice(pagesRootIndex + 1, -1);
    const routeInfo = pageRouteFromRelativeParts(relativeParts, base);
    for (const group of routeInfo.routeGroupNames) {
      context.summary.routeGroups.add(group);
    }

    pageFiles.push({
      uri: file.uri,
      routePattern: routeInfo.routePattern,
      segments: routeInfo.segments,
      routeGroupNames: routeInfo.routeGroupNames,
    });

    registerRouteFile(context, {
      uri: file.uri,
      role: "page",
      routePattern: routeInfo.routePattern,
      scopeIds: [scopeId],
      projectNames: file.projectNames,
      moduleBoundary: moduleBoundaryForUri(file.uri),
      routeGroupNames: routeInfo.routeGroupNames.length > 0 ? routeInfo.routeGroupNames : undefined,
    });
  }

  const routeMap = new Map<string, NuxtRouteEntry>();
  for (const page of pageFiles) {
    const key = `${scopeId}\0${page.routePattern}`;
    const parentCandidates = pageFiles.filter((candidate) => {
      if (candidate.uri === page.uri) {
        return false;
      }
      return (
        page.routePattern.startsWith(`${candidate.routePattern}/`) ||
        (candidate.routePattern !== "/" && page.routePattern.startsWith(candidate.routePattern))
      );
    });

    const parentPageUris: string[] = [];
    for (const parent of parentCandidates) {
      const parentBase = parent.uri.replace(/\.vue$/, "");
      const childDir = dirname(page.uri);
      if (childDir === parentBase || `${childDir}/index` === parentBase) {
        if (hasNuxtPageOutlet(context.vueCatalog, parent.uri)) {
          parentPageUris.push(parent.uri);
          registerRouteFile(context, {
            uri: parent.uri,
            role: "parent-page",
            routePattern: page.routePattern,
            scopeIds: [scopeId],
            moduleBoundary: moduleBoundaryForUri(parent.uri),
          });
        } else {
          context.diagnostics.push(
            createNuxtDiagnostic(
              "nuxt-parent-without-page-outlet",
              "info",
              undefined,
              { uri: parent.uri, routePattern: page.routePattern },
            ),
          );
        }
      }
    }

    if (parentPageUris.length > 0) {
      context.summary.nestedRoutes += 1;
    }

    const entry: NuxtRouteEntry = {
      routePattern: page.routePattern,
      segments: page.segments,
      pageUris: [page.uri],
      parentPageUris: sortStringArray(parentPageUris),
      sharedUris: sortStringArray(appShellUris),
      layoutUris: sortStringArray(defaultLayoutUris),
      errorUris: sortStringArray(errorUris),
      scopeIds: [scopeId],
      projectNames: scopedFiles.find((f) => f.uri === page.uri)?.projectNames,
      routeGroupNames: page.routeGroupNames.length > 0 ? page.routeGroupNames : undefined,
    };

    const existing = routeMap.get(key);
    if (existing) {
      existing.pageUris = sortStringArray([...existing.pageUris, ...entry.pageUris]);
    } else {
      routeMap.set(key, entry);
    }
  }

  routes.push(...routeMap.values());
  routes.sort((left, right) => left.routePattern.localeCompare(right.routePattern));
  return routes;
}

export function buildNuxtRouteCatalog(input: {
  scopedFiles: IndexedSourceFile[];
  vueCatalog: VueSourceCatalog;
  maxRoutes: number;
}): {
  routes: NuxtRouteEntry[];
  files: NuxtRouteFile[];
  diagnostics: NuxtSourceDiagnostic[];
  summary: NuxtRouteCatalogSummary;
  status: "complete" | "partial" | "invalid";
} {
  const context: BuildContext = {
    diagnostics: [],
    summary: {
      nuxt3PageRoots: new Set(),
      nuxt4PageRoots: new Set(),
      routeGroups: new Set(),
      nestedRoutes: 0,
      unsupportedPageFiles: 0,
    },
    vueCatalog: input.vueCatalog,
    routeFiles: new Map(),
  };

  const scopeGroups = new Map<string, IndexedSourceFile[]>();
  for (const file of input.scopedFiles) {
    const isNuxt = isNuxtScopeFile(file.frameworks) ||
      findNuxt4PageRootIndex(file.uri.split("/")) !== undefined ||
      findNuxt3PageRootIndex(file.uri.split("/")) !== undefined;
    if (!isNuxt) {
      continue;
    }
    for (const scopeId of file.scopeIds) {
      const group = scopeGroups.get(scopeId) ?? [];
      group.push(file);
      scopeGroups.set(scopeId, group);
    }
  }

  const routes: NuxtRouteEntry[] = [];
  let status: "complete" | "partial" | "invalid" = "complete";

  for (const [scopeId, files] of [...scopeGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (routes.length >= input.maxRoutes) {
      status = "partial";
      context.diagnostics.push(createNuxtDiagnostic("nuxt-route-limit-reached", "warning"));
      break;
    }
    const scopeRoutes = buildRoutesForScope(files, context, scopeId);
    routes.push(...scopeRoutes);
    if (scopeRoutes.length > 0) {
      context.diagnostics.push(
        createNuxtDiagnostic("nuxt-page-root-found", "info", undefined, { scopeId }),
      );
    }
  }

  routes.sort((left, right) => {
    const scopeDiff = (left.scopeIds[0] ?? "").localeCompare(right.scopeIds[0] ?? "");
    if (scopeDiff !== 0) {
      return scopeDiff;
    }
    return left.routePattern.localeCompare(right.routePattern);
  });

  const files = [...context.routeFiles.values()].sort((left, right) => {
    const uriDiff = left.uri.localeCompare(right.uri);
    if (uriDiff !== 0) {
      return uriDiff;
    }
    return left.role.localeCompare(right.role);
  });

  let staticRoutes = 0;
  let dynamicRoutes = 0;
  let optionalRoutes = 0;
  let catchAllRoutes = 0;
  for (const route of routes) {
    if (route.segments.every((segment) => segment.kind === "static")) {
      staticRoutes += 1;
    }
    if (route.segments.some((segment) => segment.kind === "dynamic")) {
      dynamicRoutes += 1;
    }
    if (route.segments.some((segment) => segment.kind === "optional")) {
      optionalRoutes += 1;
    }
    if (route.segments.some((segment) => segment.kind === "catch-all")) {
      catchAllRoutes += 1;
    }
  }

  const summary: NuxtRouteCatalogSummary = {
    scopes: scopeGroups.size,
    nuxt3PageRoots: context.summary.nuxt3PageRoots.size,
    nuxt4PageRoots: context.summary.nuxt4PageRoots.size,
    routes: routes.length,
    staticRoutes,
    dynamicRoutes,
    optionalRoutes,
    catchAllRoutes,
    routeGroups: context.summary.routeGroups.size,
    nestedRoutes: context.summary.nestedRoutes,
    unsupportedPageFiles: context.summary.unsupportedPageFiles,
  };

  if (context.summary.unsupportedPageFiles > 0) {
    context.diagnostics.push(
      createNuxtDiagnostic("nuxt-page-source-unsupported", "info"),
    );
  }

  return {
    routes,
    files,
    diagnostics: context.diagnostics,
    summary,
    status,
  };
}
