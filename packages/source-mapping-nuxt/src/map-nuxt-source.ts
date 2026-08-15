import type {
  NuxtRouteCatalog,
  NuxtRouteEntry,
  NuxtRouteFile,
  NuxtRouteFileRole,
  NuxtSourceMappingEvidence,
  SourceMappingResult,
  VueSourceCatalog,
} from "@a11yst/types";
import { createMappingFromExistingSourceLocation } from "@a11yst/source-mapping";
import { mapVueSource } from "@a11yst/source-mapping-vue";
import { resolveRoutesForPath } from "./catalog.js";
import { createNuxtDiagnostic } from "./diagnostics.js";
import { normalizeNuxtRoutePath } from "./sanitize.js";

function filterVueCatalog(
  vueCatalog: VueSourceCatalog,
  uris: Set<string>,
): VueSourceCatalog {
  return {
    ...vueCatalog,
    files: vueCatalog.files
      .filter((file) => uris.has(file.uri))
      .map((file) => ({
        ...file,
        elements: [...file.elements],
      })),
  };
}

function routeFileRoleForUri(
  uri: string,
  routeFiles: NuxtRouteFile[],
): NuxtRouteFileRole | undefined {
  return routeFiles.find((file) => file.uri === uri)?.role;
}

function collectAssociationUris(input: {
  route: NuxtRouteEntry;
  routeFiles: NuxtRouteFile[];
  fileRole?: "page" | "error";
  layoutName?: string;
}): { uris: Set<string>; diagnostics: ReturnType<typeof createNuxtDiagnostic>[] } {
  const uris = new Set<string>();
  const diagnostics: ReturnType<typeof createNuxtDiagnostic>[] = [];

  if (input.fileRole === "error") {
    for (const uri of input.route.errorUris) {
      uris.add(uri);
    }
    for (const uri of input.route.sharedUris) {
      uris.add(uri);
    }
    if (uris.size === 0) {
      diagnostics.push(createNuxtDiagnostic("nuxt-error-page-not-found", "info"));
    }
    return { uris, diagnostics };
  }

  for (const uri of input.route.pageUris) {
    uris.add(uri);
  }
  for (const uri of input.route.parentPageUris) {
    uris.add(uri);
  }
  for (const uri of input.route.sharedUris) {
    uris.add(uri);
  }

  if (input.layoutName) {
    const layoutFiles = input.routeFiles.filter(
      (file) =>
        file.role === "layout" &&
        file.layoutName === input.layoutName &&
        file.scopeIds.some((scopeId) => input.route.scopeIds.includes(scopeId)),
    );
    if (layoutFiles.length === 0) {
      diagnostics.push(createNuxtDiagnostic("nuxt-layout-not-found", "info"));
    } else {
      for (const file of layoutFiles) {
        uris.add(file.uri);
      }
    }
  } else {
    for (const uri of input.route.layoutUris) {
      uris.add(uri);
    }
  }

  return { uris, diagnostics };
}

function toVueEvidence(evidence: NuxtSourceMappingEvidence) {
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
    route: evidence.route,
    scopeIds: evidence.scopeIds,
    existingSourceLocation: evidence.existingSourceLocation,
  };
}

function enrichCandidate(
  result: SourceMappingResult,
  input: {
    route: NuxtRouteEntry;
    routeFiles: NuxtRouteFile[];
    normalizedRoute?: string;
    layoutName?: string;
  },
): SourceMappingResult {
  const candidates = result.candidates.map((candidate) => {
    const fileRole = routeFileRoleForUri(candidate.location.uri, input.routeFiles) ?? "page";
    const routeFile = input.routeFiles.find((file) => file.uri === candidate.location.uri);
    const signals = [
      ...candidate.signals,
      {
        kind: "route" as const,
        matched: true,
        value: input.route.routePattern.slice(0, 128),
      },
      {
        kind: "framework-metadata" as const,
        matched: true,
        value: fileRole,
      },
    ];

    return {
      ...candidate,
      framework: "nuxt",
      adapter: "nuxt-static",
      signals,
      nuxt: {
        routePattern: input.route.routePattern,
        fileRole,
        layoutName: input.layoutName ?? routeFile?.layoutName,
        moduleBoundary: routeFile?.moduleBoundary,
        routeGroupNames: input.route.routeGroupNames,
      },
    };
  });

  return {
    ...result,
    candidates,
    selected:
      result.selected === undefined
        ? undefined
        : candidates.find(
            (candidate) =>
              candidate.location.uri === result.selected!.location.uri &&
              candidate.location.region.start.line === result.selected!.location.region.start.line &&
              (candidate.location.region.start.column ?? 0) ===
                (result.selected!.location.region.start.column ?? 0),
          ),
  };
}

export function mapNuxtSource(input: {
  evidence: NuxtSourceMappingEvidence;
  routeCatalog: NuxtRouteCatalog;
  vueCatalog: VueSourceCatalog;
}): SourceMappingResult {
  const evidence = input.evidence;

  if (evidence.existingSourceLocation !== undefined) {
    return createMappingFromExistingSourceLocation(evidence.existingSourceLocation);
  }

  if (evidence.route === undefined) {
    return mapVueSource({
      evidence: toVueEvidence(evidence),
      catalog: input.vueCatalog,
    });
  }

  const normalizedRoute = normalizeNuxtRoutePath(evidence.route);
  if (normalizedRoute === undefined) {
    return {
      status: "invalid",
      candidates: [],
      diagnostics: [
        {
          code: "invalid-source-uri",
          level: "error",
          message: "Nuxt route evidence is unsafe",
        },
      ],
    };
  }

  const resolution = resolveRoutesForPath({
    routeCatalog: input.routeCatalog,
    normalizedPath: normalizedRoute,
    scopeIds: evidence.scopeIds,
  });

  if (resolution.status === "not-matched") {
    return {
      status: "unmapped",
      candidates: [],
      diagnostics: [
        {
          code: "missing-source-location",
          level: "info",
          message: "Nuxt route was not matched",
        },
      ],
    };
  }

  if (resolution.status === "ambiguous") {
    return {
      status: "ambiguous",
      candidates: [],
      diagnostics: [
        {
          code: "ambiguous-candidates",
          level: "info",
          message: "Nuxt route resolution is ambiguous",
        },
      ],
    };
  }

  const route = resolution.routes[0]!;
  const { uris, diagnostics: assocDiagnostics } = collectAssociationUris({
    route,
    routeFiles: input.routeCatalog.files,
    fileRole: evidence.fileRole,
    layoutName: evidence.layoutName,
  });

  if (uris.size === 0) {
    return {
      status: "unmapped",
      candidates: [],
      diagnostics: [
        ...assocDiagnostics.map((d) => ({
          code: "missing-source-location" as const,
          level: d.level,
          message: d.message,
        })),
        {
          code: "missing-source-location",
          level: "info",
          message: "Nuxt route files were not associated",
        },
      ],
    };
  }

  const filteredCatalog = filterVueCatalog(input.vueCatalog, uris);
  const vueResult = mapVueSource({
    evidence: toVueEvidence(evidence),
    catalog: filteredCatalog,
  });

  return enrichCandidate(vueResult, {
    route,
    routeFiles: input.routeCatalog.files,
    normalizedRoute,
    layoutName: evidence.layoutName,
  });
}
