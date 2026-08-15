export type {
  NextRouteCatalog,
  NextRouteCatalogOptions,
  NextRouteCatalogSummary,
  NextRouteEntry,
  NextRouteFile,
  NextRouteFileRole,
  NextRouteSegment,
  NextRouterKind,
  NextModuleBoundary,
  NextSourceDiagnostic,
  NextSourceDiagnosticCode,
  NextSourceMappingEvidence,
  NextCandidateMetadata,
} from "@a11yst/types";

export {
  DEFAULT_MAX_FILES_PER_ROUTE,
  DEFAULT_MAX_ROUTES,
} from "./constants.js";
export { NextSourceValidationError } from "./errors.js";
export {
  createNextRouteCatalog,
  resolveRoutesForPath,
  type CreateNextRouteCatalogInput,
  type RouteResolutionResult,
} from "./catalog.js";
export { mapNextSource } from "./map-next-source.js";
export { normalizeNextRoutePath, sortStringArray } from "./sanitize.js";
export {
  matchPathToPattern,
  pathSegmentsFromRoute,
  compareRouteSpecificity,
  routeSpecificity,
} from "./route-matching.js";
export { segmentsToRoutePattern, parseUrlSegment } from "./route-segments.js";
export { stableSerializeNextCatalog } from "./serialize.js";
