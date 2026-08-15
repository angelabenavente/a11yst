/**
 * React/JSX static source catalog and mapping contracts.
 * Implementation lives in `@a11yst/source-mapping-react`.
 */

import type { ExistingSourceLocation, SourceRegion } from "./source-mapping.js";

export type ReactSourceCatalogOptions = {
  maxFiles?: number;
  maxElementsPerFile?: number;
  maxPropsPerElement?: number;
  maxTextLength?: number;
};

export type ReactSourceElementKind = "intrinsic" | "component";

export type ReactSourceElement = {
  uri: string;
  region: SourceRegion;
  elementKind: ReactSourceElementKind;
  tagName?: string;
  componentName?: string;
  ownerComponent?: string;
  staticProps: Record<string, string | number | boolean>;
  dynamicPropNames: string[];
  classNames: string[];
  hasSpreadProps: boolean;
  spreadBeforeStaticProps: boolean;
  staticVisibleText?: string;
  staticAccessibleName?: string;
  scopeIds: string[];
  projectNames?: string[];
  frameworks?: string[];
};

export type ReactSourceFile = {
  uri: string;
  elements: ReactSourceElement[];
  scopeIds: string[];
  projectNames?: string[];
  frameworks?: string[];
  hasJsx: boolean;
  moduleBoundary?: "client" | "server" | "unknown";
};

export type ReactSourceDiagnosticCode =
  | "unsafe-react-source-uri"
  | "react-file-not-found"
  | "react-file-not-regular"
  | "react-file-read-failed"
  | "react-parse-warning"
  | "react-parse-failed"
  | "react-file-limit-reached"
  | "react-element-limit-reached"
  | "react-prop-limit-reached"
  | "react-file-without-jsx"
  | "react-dynamic-prop"
  | "react-spread-props"
  | "react-fragment-ignored"
  | "invalid-react-mapping-evidence"
  | "unsupported-react-selector"
  | "invalid-react-selector"
  | "unknown-react-scope"
  | "react-source-not-matched"
  | "react-source-ambiguous"
  | "react-sensitive-value-redacted"
  | "react-text-truncated";

export type ReactSourceDiagnostic = {
  code: ReactSourceDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
  uri?: string;
};

export type ReactSourceCatalogSummary = {
  inputFiles: number;
  parsedFiles: number;
  filesWithoutJsx: number;
  failedFiles: number;
  indexedElements: number;
  intrinsicElements: number;
  componentUsages: number;
  dynamicProps: number;
  spreadProps: number;
  truncatedFiles: number;
};

export type ReactSourceCatalog = {
  version: 1;
  status: "complete" | "partial" | "invalid";
  files: ReactSourceFile[];
  diagnostics: ReactSourceDiagnostic[];
  summary: ReactSourceCatalogSummary;
};

export type ReactSourceMappingEvidence = {
  selector?: string;
  tagName?: string;
  elementId?: string;
  classNames?: string[];
  attributes?: Record<string, string>;
  accessibleName?: string;
  visibleText?: string;
  componentName?: string;
  ownerComponent?: string;
  scopeIds?: string[];
  route?: string;
  existingSourceLocation?: ExistingSourceLocation;
};
