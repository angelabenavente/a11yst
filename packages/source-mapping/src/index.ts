export type {
  ExistingSourceLocation,
  SourceLocation,
  SourceMappingCandidate,
  SourceMappingConfidence,
  SourceMappingDiagnostic,
  SourceMappingDiagnosticCode,
  SourceMappingProvenance,
  SourceMappingResult,
  SourceMappingSignal,
  SourceMappingSignalKind,
  SourceMappingStatus,
  SourcePosition,
  SourceRegion,
} from "@a11yst/types";

export { SourceMappingValidationError } from "./errors.js";
export { UnsafeSourceUriError } from "./normalize-uri.js";

export { normalizeSourceUri, isUnsafeAbsolutePath } from "./normalize-uri.js";
export { validateSourceRegion } from "./validate-region.js";
export {
  validateSourceLocation,
  flatToRegion,
  regionToFlat,
  candidateLocationKey,
  candidateDedupeKey,
} from "./location.js";

export {
  validateConfidenceProvenance,
  compareConfidence,
  compareProvenance,
  isExactAllowedProvenance,
  CONFIDENCE_ORDER,
  PROVENANCE_ORDER,
} from "./confidence-provenance.js";

export {
  sanitizeSignal,
  sanitizeSignals,
  mergeSignals,
  sortSignals,
  compareSignals,
  MAX_SIGNAL_VALUE_LENGTH,
  SIGNAL_KIND_ORDER,
} from "./signals.js";

export {
  compareCandidates,
  sortCandidates,
  dedupeCandidates,
  compareDiagnostics,
  sortDiagnostics,
  mergeDiagnostics,
} from "./compare.js";

export { createDiagnostic } from "./diagnostics.js";

export {
  createSourceMappingCandidate,
  createSourceMappingResult,
  createMappingFromExistingSourceLocation,
} from "./create-result.js";

export {
  serializeSourceMappingResult,
  stableSerializeSourceMappingResult,
  omitUndefinedDeep,
} from "./serialize.js";
