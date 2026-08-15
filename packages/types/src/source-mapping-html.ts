/**
 * HTML static source catalog and mapping contracts.
 *
 * Implementation lives in `@a11yst/source-mapping-html`.
 */

import type { ExistingSourceLocation, SourceRegion } from "./source-mapping.js";

export type HtmlSourceCatalogOptions = {
  maxFiles?: number;
  maxElementsPerFile?: number;
  maxTextLength?: number;
};

export type HtmlSourceElement = {
  uri: string;
  region: SourceRegion;
  tagName: string;
  id?: string;
  classNames: string[];
  attributes: Record<string, string>;
  staticAccessibleName?: string;
  staticVisibleText?: string;
  scopeIds: string[];
  projectNames?: string[];
  frameworks?: string[];
};

export type HtmlSourceFile = {
  uri: string;
  elements: HtmlSourceElement[];
  scopeIds: string[];
  projectNames?: string[];
  frameworks?: string[];
};

export type HtmlSourceDiagnosticCode =
  | "unsafe-html-source-uri"
  | "html-file-not-found"
  | "html-file-not-regular"
  | "html-file-read-failed"
  | "html-parse-warning"
  | "html-element-limit-reached"
  | "html-file-limit-reached"
  | "invalid-html-mapping-evidence"
  | "unsupported-html-selector"
  | "invalid-html-selector"
  | "unknown-html-scope"
  | "html-route-not-matched"
  | "html-source-not-matched"
  | "html-source-ambiguous"
  | "html-sensitive-value-redacted"
  | "html-text-truncated";

export type HtmlSourceDiagnostic = {
  code: HtmlSourceDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
  uri?: string;
};

export type HtmlSourceCatalogSummary = {
  inputFiles: number;
  parsedFiles: number;
  failedFiles: number;
  indexedElements: number;
  truncatedFiles: number;
};

export type HtmlSourceCatalog = {
  version: 1;
  status: "complete" | "partial" | "invalid";
  files: HtmlSourceFile[];
  diagnostics: HtmlSourceDiagnostic[];
  summary: HtmlSourceCatalogSummary;
};

export type HtmlSourceMappingEvidence = {
  selector?: string;
  tagName?: string;
  elementId?: string;
  classNames?: string[];
  accessibleName?: string;
  visibleText?: string;
  attributes?: Record<string, string>;
  route?: string;
  scopeIds?: string[];
  existingSourceLocation?: ExistingSourceLocation;
};
