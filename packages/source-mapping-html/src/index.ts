export type {
  HtmlSourceCatalog,
  HtmlSourceCatalogOptions,
  HtmlSourceCatalogSummary,
  HtmlSourceDiagnostic,
  HtmlSourceDiagnosticCode,
  HtmlSourceElement,
  HtmlSourceFile,
  HtmlSourceMappingEvidence,
} from "@a11yst/types";

export {
  DEFAULT_MAX_ELEMENTS_PER_FILE,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_TEXT_LENGTH,
  ALLOWED_ATTRIBUTES,
} from "./constants.js";
export { HtmlSourceValidationError } from "./errors.js";
export {
  createHtmlSourceCatalog,
  createNodeHtmlCatalogFileSystem,
  type CreateHtmlSourceCatalogInput,
  type HtmlCatalogFileSystem,
} from "./catalog.js";
export { mapHtmlSource } from "./map-html-source.js";
export { normalizeRoute, routeCandidatesForUri } from "./routes.js";
export { parseHtmlSelector, selectorMatchesElement } from "./selectors.js";
export { resolveHtmlCatalogOptions, normalizeText, sanitizeSelector } from "./sanitize.js";
export { stableSerializeHtmlCatalog } from "./serialize.js";
