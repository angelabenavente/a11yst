export type {
  VueSourceCatalog,
  VueSourceCatalogOptions,
  VueSourceCatalogSummary,
  VueSourceElement,
  VueSourceElementKind,
  VueSourceFile,
  VueSourceDiagnostic,
  VueSourceDiagnosticCode,
  VueSourceMappingEvidence,
  VueStaticAttributeValue,
} from "@a11yst/types";

export {
  DEFAULT_MAX_ATTRIBUTES_PER_ELEMENT,
  DEFAULT_MAX_ELEMENTS_PER_FILE,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_TEXT_LENGTH,
} from "./constants.js";
export { VueSourceValidationError } from "./errors.js";
export {
  createVueSourceCatalog,
  type CreateVueSourceCatalogInput,
  type VueCatalogFileSystem,
  createNodeVueCatalogFileSystem,
} from "./catalog.js";
export { mapVueSource } from "./map-vue-source.js";
export {
  parseVueSelector,
  matchNativeElementsBySelector,
  matchNativeElementsById,
  matchComponentByName,
} from "./selectors.js";
export {
  normalizeText,
  sanitizeSelector,
  sanitizeEvidenceText,
  componentNameAliases,
  ownerHintFromFilename,
  sortStringArray,
} from "./sanitize.js";
export { parseVueSfc } from "./parse-vue-template.js";
export { stableSerializeVueCatalog } from "./serialize.js";
