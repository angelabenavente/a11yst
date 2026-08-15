/**
 * Angular static source catalog and mapping contracts.
 * Implementation lives in `@a11yst/source-mapping-angular`.
 */

import type { ExistingSourceLocation, SourceRegion } from "./source-mapping.js";

export type AngularTemplateKind = "external" | "inline";

export type AngularSourceCatalogOptions = {
  maxTypeScriptFiles?: number;
  maxTemplateFiles?: number;
  maxComponents?: number;
  maxElementsPerTemplate?: number;
  maxAttributesPerElement?: number;
  maxTextLength?: number;
};

export type AngularSourceComponent = {
  sourceUri: string;
  className?: string;
  selector?: string;
  elementSelector?: string;
  templateKind?: AngularTemplateKind;
  templateUri?: string;
  scopeIds: string[];
  projectNames?: string[];
  standalone?: boolean;
};

export type AngularSourceElementKind = "native" | "component";

export type AngularSourceElement = {
  uri: string;
  region: SourceRegion;
  elementKind: AngularSourceElementKind;
  tagName?: string;
  componentName?: string;
  ownerComponent?: string;
  componentSelector?: string;
  staticAttributes: Record<string, string | number | boolean>;
  dynamicAttributeNames: string[];
  classNames: string[];
  hasAttributeSpread: boolean;
  hasConditionalRendering: boolean;
  hasRepeatedRendering: boolean;
  hasDeferredRendering: boolean;
  staticVisibleText?: string;
  staticAccessibleName?: string;
  templateKind: AngularTemplateKind;
  scopeIds: string[];
  projectNames?: string[];
};

export type AngularSourceTemplate = {
  templateKind: AngularTemplateKind;
  uri: string;
  ownerSourceUri: string;
  ownerComponent?: string;
  componentSelector?: string;
  elements: AngularSourceElement[];
  scopeIds: string[];
  projectNames?: string[];
};

export type AngularSourceDiagnosticCode =
  | "unsafe-angular-source-uri"
  | "angular-typescript-file-not-found"
  | "angular-typescript-file-not-regular"
  | "angular-typescript-read-failed"
  | "angular-typescript-parse-failed"
  | "angular-component-metadata-dynamic"
  | "angular-component-selector-dynamic"
  | "angular-component-selector-unsupported"
  | "angular-template-missing"
  | "angular-template-dynamic"
  | "angular-template-url-dynamic"
  | "angular-template-url-unsafe"
  | "angular-template-not-indexed"
  | "angular-template-file-not-found"
  | "angular-template-file-not-regular"
  | "angular-template-read-failed"
  | "angular-template-parse-warning"
  | "angular-template-parse-failed"
  | "angular-inline-template-location-unsupported"
  | "angular-component-limit-reached"
  | "angular-template-limit-reached"
  | "angular-element-limit-reached"
  | "angular-attribute-limit-reached"
  | "angular-dynamic-binding"
  | "angular-event-binding"
  | "angular-two-way-binding"
  | "angular-structural-directive"
  | "angular-content-projection-unresolved"
  | "invalid-angular-mapping-evidence"
  | "unsupported-angular-selector"
  | "invalid-angular-selector"
  | "unknown-angular-scope"
  | "angular-source-not-matched"
  | "angular-source-ambiguous"
  | "angular-sensitive-value-redacted"
  | "angular-text-truncated";

export type AngularSourceDiagnostic = {
  code: AngularSourceDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
  uri?: string;
  componentName?: string;
};

export type AngularSourceCatalogSummary = {
  inputTypeScriptFiles: number;
  inputTemplateFiles: number;
  parsedTypeScriptFiles: number;
  parsedTemplateFiles: number;
  components: number;
  externalTemplates: number;
  inlineTemplates: number;
  componentsWithoutStaticTemplate: number;
  indexedElements: number;
  nativeElements: number;
  componentUsages: number;
  dynamicBindings: number;
  eventBindings: number;
  twoWayBindings: number;
  structuralDirectives: number;
  controlFlowBlocks: number;
  failedTypeScriptFiles: number;
  failedTemplates: number;
  unassociatedTemplates: number;
};

export type AngularSourceCatalog = {
  version: 1;
  status: "complete" | "partial" | "invalid";
  components: AngularSourceComponent[];
  templates: AngularSourceTemplate[];
  diagnostics: AngularSourceDiagnostic[];
  summary: AngularSourceCatalogSummary;
};

export type AngularSourceMappingEvidence = {
  selector?: string;
  tagName?: string;
  elementId?: string;
  classNames?: string[];
  attributes?: Record<string, string>;
  accessibleName?: string;
  visibleText?: string;
  componentName?: string;
  componentSelector?: string;
  ownerComponent?: string;
  route?: string;
  scopeIds?: string[];
  templateKind?: AngularTemplateKind;
  existingSourceLocation?: ExistingSourceLocation;
};

export type AngularCandidateMetadata = {
  templateKind?: AngularTemplateKind;
  componentSelector?: string;
  standalone?: boolean;
  hasConditionalRendering?: boolean;
  hasRepeatedRendering?: boolean;
  hasDeferredRendering?: boolean;
};
