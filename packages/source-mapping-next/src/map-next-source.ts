import type {
  NextRouteCatalog,
  NextRouteEntry,
  NextRouteFile,
  NextRouteFileRole,
  NextSourceMappingEvidence,
  ReactSourceCatalog,
  SourceMappingResult,
} from "@a11yst/types";
import { createMappingFromExistingSourceLocation } from "@a11yst/source-mapping";
import { mapReactSource } from "@a11yst/source-mapping-react";
import { resolveRoutesForPath } from "./catalog.js";
import { createNextDiagnostic } from "./diagnostics.js";
import { normalizeNextRoutePath } from "./sanitize.js";
import { STATE_ROLES } from "./constants.js";

const STATE_ROLE_SET = new Set<string>(STATE_ROLES);

function filterReactCatalog(
  reactCatalog: ReactSourceCatalog,
  uris: Set<string>,
): ReactSourceCatalog {
  return {
    ...reactCatalog,
    files: reactCatalog.files
      .filter((file) => uris.has(file.uri))
      .map((file) => ({
        ...file,
        elements: [...file.elements],
      })),
  };
}

function routeFileRoleForUri(
  uri: string,
  routeFiles: NextRouteFile[],
): NextRouteFileRole | undefined {
  return routeFiles.find((file) => file.uri === uri)?.role;
}

function collectAssociationUris(input: {
  route: NextRouteEntry;
  routeFiles: NextRouteFile[];
  fileRole?: NextRouteFileRole;
  parallelRouteSlot?: string;
}): { uris: Set<string>; diagnostics: ReturnType<typeof createNextDiagnostic>[] } {
  const uris = new Set<string>();
  const diagnostics: ReturnType<typeof createNextDiagnostic>[] = [];

  if (input.parallelRouteSlot) {
    const slotFiles = input.routeFiles.filter(
      (file) =>
        file.router === input.route.router &&
        file.parallelSlot === input.parallelRouteSlot &&
        file.scopeIds.some((scopeId) => input.route.scopeIds.includes(scopeId)),
    );
    if (slotFiles.length === 0) {
      diagnostics.push(
        createNextDiagnostic("next-parallel-slot-not-found", "info", "Parallel route slot was not found"),
      );
      return { uris, diagnostics };
    }
    for (const file of slotFiles) {
      uris.add(file.uri);
    }
    for (const layoutUri of input.route.layoutUris) {
      uris.add(layoutUri);
    }
    return { uris, diagnostics };
  }

  if (input.fileRole && STATE_ROLE_SET.has(input.fileRole)) {
    const stateUris = input.route.stateUris[input.fileRole] ?? [];
    if (stateUris.length === 0) {
      diagnostics.push(
        createNextDiagnostic("next-file-role-not-found", "info", "Requested Next.js file role was not found"),
      );
      return { uris, diagnostics };
    }
    for (const uri of stateUris) {
      uris.add(uri);
    }
    for (const layoutUri of input.route.layoutUris) {
      uris.add(layoutUri);
    }
    return { uris, diagnostics };
  }

  if (input.fileRole === "error" && input.route.router === "pages") {
    const errorUris = input.route.stateUris.error ?? [];
    if (errorUris.length === 0) {
      diagnostics.push(
        createNextDiagnostic("next-file-role-not-found", "info", "Pages Router error file was not found"),
      );
      return { uris, diagnostics };
    }
    for (const uri of errorUris) {
      uris.add(uri);
    }
    for (const sharedUri of input.route.sharedUris) {
      uris.add(sharedUri);
    }
    return { uris, diagnostics };
  }

  for (const uri of input.route.pageUris) {
    uris.add(uri);
  }
  for (const uri of input.route.layoutUris) {
    uris.add(uri);
  }
  for (const uri of input.route.templateUris) {
    uris.add(uri);
  }
  for (const uri of input.route.sharedUris) {
    uris.add(uri);
  }

  return { uris, diagnostics };
}

function toReactEvidence(evidence: NextSourceMappingEvidence) {
  return {
    selector: evidence.selector,
    tagName: evidence.tagName,
    elementId: evidence.elementId,
    classNames: evidence.classNames,
    attributes: evidence.attributes,
    accessibleName: evidence.accessibleName,
    visibleText: evidence.visibleText,
    componentName: evidence.componentName,
    ownerComponent: evidence.ownerComponent,
    scopeIds: evidence.scopeIds,
    existingSourceLocation: evidence.existingSourceLocation,
  };
}

function enrichCandidate(
  result: SourceMappingResult,
  input: {
    route: NextRouteEntry;
    routeFiles: NextRouteFile[];
    normalizedRoute?: string;
  },
): SourceMappingResult {
  const candidates = result.candidates.map((candidate) => {
    const fileRole = routeFileRoleForUri(candidate.location.uri, input.routeFiles) ?? "page";
    const routeFile = input.routeFiles.find((file) => file.uri === candidate.location.uri);
    const signals = [
      ...candidate.signals,
      ...(input.normalizedRoute
        ? [{ kind: "route" as const, matched: true, value: input.route.routePattern.slice(0, 128) }]
        : []),
      {
        kind: "framework-metadata" as const,
        matched: true,
        value: `${input.route.router}:${fileRole}`.slice(0, 128),
      },
    ];
    return {
      ...candidate,
      framework: "next",
      adapter: "next-static",
      signals,
      next: {
        router: input.route.router,
        routePattern: input.route.routePattern,
        fileRole,
        moduleBoundary: routeFile?.moduleBoundary,
        routeGroupNames: routeFile?.routeGroupNames ?? input.route.routeGroupNames,
        parallelRouteSlot: routeFile?.parallelSlot,
      },
    };
  });

  const selected =
    result.selected !== undefined
      ? candidates.find(
          (candidate) =>
            candidate.location.uri === result.selected!.location.uri &&
            candidate.location.region.start.line === result.selected!.location.region.start.line &&
            (candidate.location.region.start.column ?? 0) ===
              (result.selected!.location.region.start.column ?? 0),
        )
      : undefined;

  return {
    ...result,
    selected,
    candidates,
  };
}

export function mapNextSource(input: {
  evidence: NextSourceMappingEvidence;
  routeCatalog: NextRouteCatalog;
  reactCatalog: ReactSourceCatalog;
}): SourceMappingResult {
  const evidence = input.evidence;

  if (evidence.existingSourceLocation !== undefined) {
    return createMappingFromExistingSourceLocation(evidence.existingSourceLocation);
  }

  if (evidence.route === undefined) {
    return mapReactSource({
      evidence: toReactEvidence(evidence),
      catalog: input.reactCatalog,
    });
  }

  const normalizedRoute = normalizeNextRoutePath(evidence.route);
  if (normalizedRoute === undefined) {
    return {
      status: "invalid",
      candidates: [],
      diagnostics: [
        {
          code: "invalid-source-uri",
          level: "error",
          message: "Next.js route evidence is unsafe",
        },
      ],
    };
  }

  if (
    evidence.router !== undefined &&
    evidence.router !== "app" &&
    evidence.router !== "pages"
  ) {
    return {
      status: "invalid",
      candidates: [],
      diagnostics: [
        {
          code: "invalid-source-uri",
          level: "error",
          message: "Next.js router hint is invalid",
        },
      ],
    };
  }

  const resolution = resolveRoutesForPath({
    catalog: input.routeCatalog,
    normalizedRoute,
    routerHint: evidence.router,
    scopeIds: evidence.scopeIds,
  });

  if (!resolution.ok) {
    if (resolution.reason === "ambiguous") {
      return {
        status: "ambiguous",
        candidates: [],
        diagnostics: [
          ...resolution.diagnostics.map((entry) => ({
            code: "ambiguous-candidates" as const,
            level: "info" as const,
            message: entry.message,
          })),
        ],
      };
    }
    return {
      status: "unmapped",
      candidates: [],
      diagnostics: [
        ...resolution.diagnostics.map((entry) => ({
          code: "missing-source-location" as const,
          level: entry.level,
          message: entry.message,
        })),
      ],
    };
  }

  if (resolution.routes.length > 1) {
    return {
      status: "ambiguous",
      candidates: [],
      diagnostics: [
        {
          code: "ambiguous-candidates",
          level: "info",
          message: "Multiple Next.js scopes matched the same route",
        },
      ],
    };
  }

  const route = resolution.routes[0]!;
  const { uris, diagnostics: associationDiagnostics } = collectAssociationUris({
    route,
    routeFiles: input.routeCatalog.files,
    fileRole: evidence.fileRole,
    parallelRouteSlot: evidence.parallelRouteSlot,
  });

  if (uris.size === 0) {
    return {
      status: "unmapped",
      candidates: [],
      diagnostics: associationDiagnostics.map((entry) => ({
        code: "missing-source-location",
        level: entry.level,
        message: entry.message,
      })),
    };
  }

  const missingReactFiles = [...uris].filter(
    (uri) => !input.reactCatalog.files.some((file) => file.uri === uri),
  );
  if (missingReactFiles.length > 0) {
    return {
      status: "unmapped",
      candidates: [],
      diagnostics: [
        {
          code: "missing-source-location",
          level: "info",
          message: "Next.js route file was not present in the React catalog",
        },
      ],
    };
  }

  const filteredCatalog = filterReactCatalog(input.reactCatalog, uris);
  const reactResult = mapReactSource({
    evidence: toReactEvidence(evidence),
    catalog: filteredCatalog,
  });

  return enrichCandidate(reactResult, {
    route,
    routeFiles: input.routeCatalog.files,
    normalizedRoute,
  });
}
