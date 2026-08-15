/**
 * Vue SFC static source catalog and mapping contracts.
 * Implementation lives in `@a11yst/source-mapping-vue`.
 */

import type { ExistingSourceLocation, SourceRegion } from "./source-mapping.js";

export type VueSourceCatalogOptions = {
  maxFiles?: number;
  maxElementsPerFile?: number;
  maxAttributesPerElement?: number;
  maxTextLength?: number;
};

export type VueSourceElementKind = "native" | "component";

export type VueStaticAttributeValue = string | number | boolean;

export type VueSourceElement = {
  uri: string;
  region: SourceRegion;
  elementKind: VueSourceElementKind;
  tagName?: string;
  componentName?: string;
  ownerComponentHint?: string;
  staticAttributes: Record<string, VueStaticAttributeValue>;
  dynamicAttributeNames: string[];
  classNames: string[];
  hasSpreadBinding: boolean;
  spreadMayOverrideStaticAttributes: boolean;
  staticVisibleText?: string;
  staticAccessibleName?: string;
  scopeIds: string[];
  projectNames?: string[];
};

export type VueSourceFile = {
  uri: string;
  elements: VueSourceElement[];
  scopeIds: string[];
  projectNames?: string[];
  hasTemplate: boolean;
};

export type VueSourceDiagnosticCode =
  | "unsafe-vue-source-uri"
  | "vue-file-not-found"
  | "vue-file-not-regular"
  | "vue-file-read-failed"
  | "vue-sfc-parse-warning"
  | "vue-sfc-parse-failed"
  | "vue-template-missing"
  | "vue-template-language-unsupported"
  | "vue-external-template-unsupported"
  | "vue-template-parse-warning"
  | "vue-file-limit-reached"
  | "vue-element-limit-reached"
  | "vue-attribute-limit-reached"
  | "vue-dynamic-binding"
  | "vue-spread-binding"
  | "invalid-vue-mapping-evidence"
  | "unsupported-vue-selector"
  | "invalid-vue-selector"
  | "unknown-vue-scope"
  | "vue-source-not-matched"
  | "vue-source-ambiguous"
  | "vue-sensitive-value-redacted"
  | "vue-text-truncated";

export type VueSourceDiagnostic = {
  code: VueSourceDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
  uri?: string;
};

export type VueSourceCatalogSummary = {
  inputFiles: number;
  parsedFiles: number;
  filesWithoutTemplate: number;
  unsupportedTemplateLanguages: number;
  failedFiles: number;
  indexedElements: number;
  nativeElements: number;
  componentUsages: number;
  dynamicBindings: number;
  spreadBindings: number;
  truncatedFiles: number;
};

export type VueSourceCatalog = {
  version: 1;
  status: "complete" | "partial" | "invalid";
  files: VueSourceFile[];
  diagnostics: VueSourceDiagnostic[];
  summary: VueSourceCatalogSummary;
};

export type VueSourceMappingEvidence = {
  selector?: string;
  tagName?: string;
  elementId?: string;
  classNames?: string[];
  attributes?: Record<string, string>;
  accessibleName?: string;
  visibleText?: string;
  componentName?: string;
  ownerComponent?: string;
  route?: string;
  scopeIds?: string[];
  existingSourceLocation?: ExistingSourceLocation;
};
