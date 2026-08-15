/**
 * Shared source-mapping contracts consumed by core, findings, results, reporters,
 * SARIF, and GitHub annotations.
 *
 * Implementation helpers live in `@a11yst/source-mapping`.
 */

export type SourcePosition = {
  line: number;
  column?: number;
};

export type SourceRegion = {
  start: SourcePosition;
  end?: SourcePosition;
};

export type SourceLocation = {
  uri: string;
  region: SourceRegion;
  symbol?: string;
  component?: string;
  language?: string;
};

/**
 * Flat source location shape already used by SARIF and GitHub annotations.
 * Structurally compatible with `@a11yst/sarif` `FindingSourceLocation`.
 */
export type ExistingSourceLocation = {
  uri: string;
  startLine: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
};

export type SourceMappingConfidence = "exact" | "high" | "medium" | "low";

export type SourceMappingProvenance =
  | "existing-source-location"
  | "runtime-metadata"
  | "source-map"
  | "framework-compiler"
  | "static-source-index"
  | "selector-match"
  | "text-match"
  | "component-match"
  | "user-provided";

export type SourceMappingSignalKind =
  | "source-location-present"
  | "source-map-resolved"
  | "component-name"
  | "element-tag"
  | "accessible-name"
  | "visible-text"
  | "attribute"
  | "selector"
  | "route"
  | "flow"
  | "checkpoint"
  | "framework-metadata";

export type SourceMappingSignal = {
  kind: SourceMappingSignalKind;
  matched: boolean;
  value?: string;
};

export type SourceMappingNextMetadata = {
  router: "app" | "pages";
  routePattern: string;
  fileRole: string;
  moduleBoundary?: "client" | "server" | "unknown";
  routeGroupNames?: string[];
  parallelRouteSlot?: string;
};

export type SourceMappingNuxtMetadata = {
  routePattern: string;
  fileRole?: string;
  layoutName?: string;
  moduleBoundary?: "client" | "server" | "unknown";
  routeGroupNames?: string[];
};

export type SourceMappingAngularMetadata = {
  templateKind?: "external" | "inline";
  componentSelector?: string;
  standalone?: boolean;
  hasConditionalRendering?: boolean;
  hasRepeatedRendering?: boolean;
  hasDeferredRendering?: boolean;
};

export type SourceMappingCandidate = {
  location: SourceLocation;
  confidence: SourceMappingConfidence;
  provenance: SourceMappingProvenance;
  signals: SourceMappingSignal[];
  framework?: string;
  adapter?: string;
  next?: SourceMappingNextMetadata;
  nuxt?: SourceMappingNuxtMetadata;
  angular?: SourceMappingAngularMetadata;
};

export type SourceMappingStatus = "mapped" | "ambiguous" | "unmapped" | "invalid";

export type SourceMappingDiagnosticCode =
  | "missing-source-location"
  | "invalid-source-uri"
  | "invalid-source-region"
  | "unsafe-source-path"
  | "duplicate-candidate"
  | "conflicting-exact-candidates"
  | "ambiguous-candidates"
  | "unsupported-provenance"
  | "truncated-signal"
  | "sensitive-value-redacted";

export type SourceMappingDiagnostic = {
  code: SourceMappingDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
  uri?: string;
};

export type SourceMappingResult = {
  status: SourceMappingStatus;
  selected?: SourceMappingCandidate;
  candidates: SourceMappingCandidate[];
  diagnostics: SourceMappingDiagnostic[];
};
