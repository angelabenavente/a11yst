export type {
  ReactSourceCatalog,
  ReactSourceCatalogOptions,
  ReactSourceCatalogSummary,
  ReactSourceDiagnostic,
  ReactSourceDiagnosticCode,
  ReactSourceElement,
  ReactSourceElementKind,
  ReactSourceFile,
  ReactSourceMappingEvidence,
} from "@a11yst/types";

export {
  DEFAULT_MAX_ELEMENTS_PER_FILE,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_PROPS_PER_ELEMENT,
  DEFAULT_MAX_TEXT_LENGTH,
  ALLOWED_PROPS,
  REACT_INDEX_KINDS,
} from "./constants.js";
export { ReactSourceValidationError } from "./errors.js";
export {
  createReactSourceCatalog,
  createNodeReactCatalogFileSystem,
  type CreateReactSourceCatalogInput,
  type ReactCatalogFileSystem,
} from "./catalog.js";
export { mapReactSource } from "./map-react-source.js";
export {
  parseReactSelector,
  matchIntrinsicElementsBySelector,
  matchIntrinsicElementsById,
} from "./selectors.js";
export {
  resolveReactCatalogOptions,
  normalizeText,
  sanitizeSelector,
  resolveIndexedReactPath,
} from "./sanitize.js";
export { parseReactSource, fileContainsJsx } from "./parse-react.js";
export { stableSerializeReactCatalog } from "./serialize.js";
