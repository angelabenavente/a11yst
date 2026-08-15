import type {
  IndexedSourceFile,
  NextModuleBoundary,
  NextRouteEntry,
  NextRouteFile,
  NextRouteFileRole,
  NextRouteSegment,
  NextRouterKind,
  NextSourceDiagnostic,
  ReactSourceCatalog,
  NextRouteCatalogSummary,
} from "@a11yst/types";
import {
  APP_UI_BASENAMES,
  ROUTE_HANDLER_BASENAMES,
  STATE_ROLES,
} from "./constants.js";
import { createNextDiagnostic } from "./diagnostics.js";
import {
  basename,
  dirname,
  isNextScopeFile,
  sortStringArray,
} from "./sanitize.js";
import {
  findAppRootIndex,
  findPagesRootIndex,
  parseAppDirectorySegments,
  parseUrlSegment,
  segmentsToRoutePattern,
  roleFromBasename,
} from "./route-segments.js";

const REACT_KINDS = new Set(["javascript", "jsx", "tsx"]);

type BuildContext = {
  diagnostics: NextSourceDiagnostic[];
  summary: {
    appRouterRoots: Set<string>;
    pagesRouterRoots: Set<string>;
    routeGroups: Set<string>;
    parallelRoutes: Set<string>;
    interceptingRoutesSkipped: number;
    apiRoutesSkipped: number;
    routeHandlersSkipped: number;
  };
  reactCatalog: ReactSourceCatalog;
};

function moduleBoundaryForUri(
  uri: string,
  reactCatalog: ReactSourceCatalog,
  router: NextRouterKind,
): NextModuleBoundary {
  if (router === "pages") {
    return "unknown";
  }
  const reactFile = reactCatalog.files.find((file) => file.uri === uri);
  return reactFile?.moduleBoundary ?? "server";
}


function classifyAppRole(name: string): NextRouteFileRole | undefined {
  const role = roleFromBasename(name);
  if (
    role === "page" ||
    role === "layout" ||
    role === "template" ||
    role === "loading" ||
    role === "error" ||
    role === "not-found" ||
    role === "default"
  ) {
    return role;
  }
  return undefined;
}

function classifyPagesRole(name: string): NextRouteFileRole | "api" | undefined {
  const base = name.replace(/\.(js|jsx|tsx)$/, "");
  if (base === "_app") {
    return "app-shell";
  }
  if (base === "_document") {
    return "document-shell";
  }
  if (base === "_error") {
    return "error";
  }
  if (base === "404" || base === "500" || base === "index" || base.length > 0) {
    return "page";
  }
  return undefined;
}

function pagesRouteFromRelativeSegments(relativeParts: string[], fileName: string): {
  segments: NextRouteSegment[];
  routePattern: string;
} {
  const routeSegments: NextRouteSegment[] = [];
  for (const segment of relativeParts) {
    const parsed = parseUrlSegment(segment);
    if (parsed) {
      routeSegments.push(parsed);
    }
  }
  const base = fileName.replace(/\.(js|jsx|tsx)$/, "");
  if (base === "404") {
    return { segments: [{ kind: "static", value: "404" }], routePattern: "/404" };
  }
  if (base === "500") {
    return { segments: [{ kind: "static", value: "500" }], routePattern: "/500" };
  }
  if (base !== "index") {
    const parsed = parseUrlSegment(base);
    if (parsed) {
      routeSegments.push(parsed);
    }
  }
  return {
    segments: routeSegments,
    routePattern: segmentsToRoutePattern(routeSegments),
  };
}

function collectAncestorFiles(
  pageDir: string,
  appRootPrefix: string,
  filesByDirRole: Map<string, Map<NextRouteFileRole, string>>,
  roles: NextRouteFileRole[],
): string[] {
  const uris: string[] = [];
  let current = pageDir;
  while (current.length >= appRootPrefix.length) {
    const roleMap = filesByDirRole.get(current);
    if (roleMap) {
      for (const role of roles) {
        const uri = roleMap.get(role);
        if (uri) {
          uris.push(uri);
        }
      }
    }
    if (current === appRootPrefix) {
      break;
    }
    const slash = current.lastIndexOf("/");
    current = slash >= 0 ? current.slice(0, slash) : appRootPrefix;
  }
  return sortStringArray(uris);
}

export function buildNextCatalogFromIndex(input: {
  files: IndexedSourceFile[];
  reactCatalog: ReactSourceCatalog;
  scopeIds?: string[];
}): {
  routes: NextRouteEntry[];
  files: NextRouteFile[];
  diagnostics: NextSourceDiagnostic[];
  summary: NextRouteCatalogSummary;
} {
  const context: BuildContext = {
    diagnostics: [],
    summary: {
      appRouterRoots: new Set<string>(),
      pagesRouterRoots: new Set<string>(),
      routeGroups: new Set<string>(),
      parallelRoutes: new Set<string>(),
      interceptingRoutesSkipped: 0,
      apiRoutesSkipped: 0,
      routeHandlersSkipped: 0,
    },
    reactCatalog: input.reactCatalog,
  };

  const scopeFilter =
    input.scopeIds !== undefined && input.scopeIds.length > 0
      ? new Set(sortStringArray(input.scopeIds))
      : undefined;

  const scopedFiles = input.files.filter((file) => {
    if (!isNextScopeFile(file.frameworks)) {
      return false;
    }
    if (scopeFilter && !file.scopeIds.some((scopeId) => scopeFilter.has(scopeId))) {
      return false;
    }
    return true;
  });

  const nextFiles = scopedFiles.filter((file) => REACT_KINDS.has(file.kind));

  const routeFiles: NextRouteFile[] = [];
  const appFilesByDirRole = new Map<string, Map<NextRouteFileRole, string>>();
  const pagesShared: { app?: string; document?: string; error?: string } = {};
  const pagesRoutes = new Map<string, NextRouteEntry>();
  const appRoutes = new Map<string, NextRouteEntry>();
  const scopeIdsSeen = new Set<string>();

  for (const file of scopedFiles) {
    const name = basename(file.uri);
    if (ROUTE_HANDLER_BASENAMES.has(name)) {
      context.summary.routeHandlersSkipped += 1;
      continue;
    }

    const parts = file.uri.split("/");
    const pagesRootIndex = findPagesRootIndex(parts);
    if (pagesRootIndex !== undefined) {
      const relativeParts = parts.slice(pagesRootIndex + 1, -1);
      if (relativeParts[0] === "api") {
        context.summary.apiRoutesSkipped += 1;
        continue;
      }
    }
  }

  for (const file of nextFiles) {
    for (const scopeId of file.scopeIds) {
      scopeIdsSeen.add(scopeId);
    }

    const name = basename(file.uri);

    if (ROUTE_HANDLER_BASENAMES.has(name)) {
      context.summary.routeHandlersSkipped += 1;
      continue;
    }

    const parts = file.uri.split("/");
    const appRootIndex = findAppRootIndex(parts);
    const pagesRootIndex = findPagesRootIndex(parts);

    if (appRootIndex !== undefined) {
      const appPrefix = parts.slice(0, appRootIndex + 1).join("/");
      context.summary.appRouterRoots.add(appPrefix);
      const role = classifyAppRole(name);
      if (!role || !APP_UI_BASENAMES.has(name)) {
        continue;
      }

      const dir = dirname(file.uri);
      const relativeDirParts = parts.slice(appRootIndex + 1, -1);
      const parsedPath = parseAppDirectorySegments(relativeDirParts);

      if (parsedPath.isPrivate) {
        continue;
      }
      if (parsedPath.isIntercepting) {
        context.summary.interceptingRoutesSkipped += 1;
        context.diagnostics.push(
          createNextDiagnostic(
            "next-intercepting-route-skipped",
            "info",
            "Intercepting App Router segment was excluded from route matching",
            { uri: file.uri },
          ),
        );
        continue;
      }

      for (const group of parsedPath.routeGroupNames) {
        context.summary.routeGroups.add(group);
      }
      if (parsedPath.parallelSlot) {
        context.summary.parallelRoutes.add(parsedPath.parallelSlot);
      }

      const routePattern =
        role === "page"
          ? segmentsToRoutePattern(parsedPath.routeSegments)
          : undefined;

      routeFiles.push({
        uri: file.uri,
        router: "app",
        role,
        routePattern,
        scopeIds: sortStringArray(file.scopeIds),
        projectNames:
          file.projectNames !== undefined ? sortStringArray(file.projectNames) : undefined,
        moduleBoundary: moduleBoundaryForUri(file.uri, input.reactCatalog, "app"),
        routeGroupNames:
          parsedPath.routeGroupNames.length > 0 ? parsedPath.routeGroupNames : undefined,
        parallelSlot: parsedPath.parallelSlot,
      });

      if (!appFilesByDirRole.has(dir)) {
        appFilesByDirRole.set(dir, new Map());
      }
      appFilesByDirRole.get(dir)!.set(role, file.uri);

      if (role === "page") {
        const key = `${file.scopeIds.join(",")}\0app\0${routePattern}`;
        if (!appRoutes.has(key)) {
          appRoutes.set(key, {
            router: "app",
            routePattern: routePattern!,
            segments: parsedPath.routeSegments,
            pageUris: [],
            layoutUris: [],
            templateUris: [],
            sharedUris: [],
            stateUris: {},
            scopeIds: sortStringArray(file.scopeIds),
            projectNames:
              file.projectNames !== undefined ? sortStringArray(file.projectNames) : undefined,
            routeGroupNames:
              parsedPath.routeGroupNames.length > 0 ? parsedPath.routeGroupNames : undefined,
          });
        }
        appRoutes.get(key)!.pageUris.push(file.uri);
      }
      continue;
    }

    if (pagesRootIndex !== undefined) {
      const pagesPrefix = parts.slice(0, pagesRootIndex + 1).join("/");
      context.summary.pagesRouterRoots.add(pagesPrefix);
      const relativeParts = parts.slice(pagesRootIndex + 1, -1);

      if (relativeParts[0] === "api") {
        context.summary.apiRoutesSkipped += 1;
        continue;
      }

      const role = classifyPagesRole(name);
      if (!role || role === "api") {
        continue;
      }

      if (role === "app-shell") {
        pagesShared.app = file.uri;
      } else if (role === "document-shell") {
        pagesShared.document = file.uri;
      } else if (role === "error") {
        pagesShared.error = file.uri;
      }

      let routeInfo = pagesRouteFromRelativeSegments(relativeParts, name);
      if (relativeParts.length === 0 && name.startsWith("index.")) {
        routeInfo = { segments: [], routePattern: "/" };
      }

      routeFiles.push({
        uri: file.uri,
        router: "pages",
        role,
        routePattern: role === "page" ? routeInfo.routePattern : undefined,
        scopeIds: sortStringArray(file.scopeIds),
        projectNames:
          file.projectNames !== undefined ? sortStringArray(file.projectNames) : undefined,
        moduleBoundary: "unknown",
      });

      if (role === "page") {
        const key = `${file.scopeIds.join(",")}\0pages\0${routeInfo.routePattern}`;
        if (!pagesRoutes.has(key)) {
          pagesRoutes.set(key, {
            router: "pages",
            routePattern: routeInfo.routePattern,
            segments: routeInfo.segments,
            pageUris: [],
            layoutUris: [],
            templateUris: [],
            sharedUris: [],
            stateUris: {},
            scopeIds: sortStringArray(file.scopeIds),
            projectNames:
              file.projectNames !== undefined ? sortStringArray(file.projectNames) : undefined,
          });
        }
        pagesRoutes.get(key)!.pageUris.push(file.uri);
      }
    }
  }

  for (const route of appRoutes.values()) {
    route.pageUris = sortStringArray(route.pageUris);
    for (const pageUri of route.pageUris) {
      const pageDir = dirname(pageUri);
      const parts = pageUri.split("/");
      const appRootIndex = findAppRootIndex(parts)!;
      const appPrefix = parts.slice(0, appRootIndex + 1).join("/");
      route.layoutUris = sortStringArray([
        ...route.layoutUris,
        ...collectAncestorFiles(pageDir, appPrefix, appFilesByDirRole, ["layout"]),
      ]);
      route.templateUris = sortStringArray([
        ...route.templateUris,
        ...collectAncestorFiles(pageDir, appPrefix, appFilesByDirRole, ["template"]),
      ]);

      for (const stateRole of STATE_ROLES) {
        const stateUris: string[] = [];
        let currentDir = pageDir;
        while (currentDir.length >= appPrefix.length) {
          const roleMap = appFilesByDirRole.get(currentDir);
          const stateUri = roleMap?.get(stateRole as NextRouteFileRole);
          if (stateUri) {
            stateUris.push(stateUri);
          }
          if (currentDir === appPrefix) {
            break;
          }
          currentDir = dirname(currentDir);
        }
        if (stateUris.length > 0) {
          route.stateUris[stateRole as NextRouteFileRole] = sortStringArray(stateUris);
        }
      }
    }
    route.layoutUris = sortStringArray(route.layoutUris);
    route.templateUris = sortStringArray(route.templateUris);
  }

  for (const route of pagesRoutes.values()) {
    route.pageUris = sortStringArray(route.pageUris);
    route.sharedUris = sortStringArray(
      [pagesShared.app, pagesShared.document].filter((uri): uri is string => uri !== undefined),
    );
    if (pagesShared.error) {
      route.stateUris.error = [pagesShared.error];
    }
  }

  const routes = [...appRoutes.values(), ...pagesRoutes.values()].sort((left, right) => {
    const scopeOrder = left.scopeIds.join(",").localeCompare(right.scopeIds.join(","));
    if (scopeOrder !== 0) {
      return scopeOrder;
    }
    const routerOrder = left.router.localeCompare(right.router);
    if (routerOrder !== 0) {
      return routerOrder;
    }
    return left.routePattern.localeCompare(right.routePattern);
  });

  let staticRoutes = 0;
  let dynamicRoutes = 0;
  let catchAllRoutes = 0;
  for (const route of routes) {
    if (route.segments.every((segment) => segment.kind === "static")) {
      staticRoutes += 1;
    }
    if (route.segments.some((segment) => segment.kind === "dynamic")) {
      dynamicRoutes += 1;
    }
    if (
      route.segments.some(
        (segment) => segment.kind === "catch-all" || segment.kind === "optional-catch-all",
      )
    ) {
      catchAllRoutes += 1;
    }
  }

  routeFiles.sort((left, right) => {
    const uriOrder = left.uri.localeCompare(right.uri);
    if (uriOrder !== 0) {
      return uriOrder;
    }
    return left.role.localeCompare(right.role);
  });

  return {
    routes,
    files: routeFiles,
    diagnostics: context.diagnostics,
    summary: {
      scopes: scopeIdsSeen.size,
      appRouterRoots: context.summary.appRouterRoots.size,
      pagesRouterRoots: context.summary.pagesRouterRoots.size,
      routes: routes.length,
      staticRoutes,
      dynamicRoutes,
      catchAllRoutes,
      routeGroups: context.summary.routeGroups.size,
      parallelRoutes: context.summary.parallelRoutes.size,
      interceptingRoutesSkipped: context.summary.interceptingRoutesSkipped,
      apiRoutesSkipped: context.summary.apiRoutesSkipped,
      routeHandlersSkipped: context.summary.routeHandlersSkipped,
    },
  };
}
