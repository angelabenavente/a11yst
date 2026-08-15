export type {
  AngularSourceCatalog,
  AngularSourceCatalogOptions,
  AngularSourceCatalogSummary,
  AngularSourceComponent,
  AngularSourceElement,
  AngularSourceElementKind,
  AngularSourceTemplate,
  AngularSourceDiagnostic,
  AngularSourceDiagnosticCode,
  AngularSourceMappingEvidence,
  AngularTemplateKind,
  AngularCandidateMetadata,
} from "@a11yst/types";

export {
  DEFAULT_MAX_ATTRIBUTES_PER_ELEMENT,
  DEFAULT_MAX_COMPONENTS,
  DEFAULT_MAX_ELEMENTS_PER_TEMPLATE,
  DEFAULT_MAX_TEMPLATE_FILES,
  DEFAULT_MAX_TEXT_LENGTH,
  DEFAULT_MAX_TYPESCRIPT_FILES,
} from "./constants.js";
export { AngularSourceValidationError } from "./errors.js";
export {
  createAngularSourceCatalog,
  type CreateAngularSourceCatalogInput,
  type AngularCatalogFileSystem,
  createNodeAngularCatalogFileSystem,
} from "./catalog.js";
export { mapAngularSource } from "./map-angular-source.js";
export {
  parseAngularSelector,
  matchNativeElementsBySelector,
  matchNativeElementsById,
  matchComponentElements,
} from "./selectors.js";
export { stableSerializeAngularCatalog } from "./serialize.js";
