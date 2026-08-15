export type {
  NuxtRouteCatalog,
  NuxtRouteCatalogOptions,
  NuxtRouteCatalogSummary,
  NuxtRouteEntry,
  NuxtRouteFile,
  NuxtRouteFileRole,
  NuxtRouteSegment,
  NuxtModuleBoundary,
  NuxtSourceDiagnostic,
  NuxtSourceDiagnosticCode,
  NuxtSourceMappingEvidence,
  NuxtCandidateMetadata,
  CreateNuxtRouteCatalogInput,
} from "@a11yst/types";

export {
  DEFAULT_MAX_FILES_PER_ROUTE,
  DEFAULT_MAX_ROUTES,
} from "./constants.js";
export { NuxtSourceValidationError } from "./errors.js";
export {
  createNuxtRouteCatalog,
  resolveRoutesForPath,
  normalizeNuxtRoutePath,
  type RouteResolutionResult,
} from "./catalog.js";
export { mapNuxtSource } from "./map-nuxt-source.js";
export {
  matchPathToPattern,
  pathSegmentsFromRoute,
  compareRouteSpecificity,
  routeSpecificity,
} from "./route-matching.js";
export {
  parseUrlSegment,
  segmentsToRoutePattern,
  parseDirectorySegments,
} from "./route-segments.js";
export { stableSerializeNuxtCatalog } from "./serialize.js";
