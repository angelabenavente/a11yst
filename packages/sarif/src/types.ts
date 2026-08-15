import type {
  BaselineSummary,
  ComparisonCoverage,
  Finding,
  PolicyEvaluationResult,
  ResolvedFinding,
  Severity,
} from "@a11yst/types";

export const SARIF_SCHEMA_URL =
  "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json";

export type SarifLevel = "none" | "note" | "warning" | "error";

export type SarifMultiformatMessage = {
  text: string;
  markdown?: string;
};

export type SarifReportingDescriptor = {
  id: string;
  name?: string;
  shortDescription?: SarifMultiformatMessage;
  fullDescription?: SarifMultiformatMessage;
  help?: SarifMultiformatMessage;
  helpUri?: string;
  defaultConfiguration?: { level: SarifLevel };
  properties?: Record<string, unknown>;
};

export type SarifToolComponent = {
  name: string;
  version: string;
  semanticVersion?: string;
  informationUri?: string;
  rules: SarifReportingDescriptor[];
};

export type SarifArtifactLocation = {
  uri: string;
};

export type SarifRegion = {
  startLine: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
};

export type SarifPhysicalLocation = {
  artifactLocation: SarifArtifactLocation;
  region: SarifRegion;
};

export type SarifLocation = {
  physicalLocation?: SarifPhysicalLocation;
  logicalLocations?: SarifLogicalLocation[];
};

export type SarifLogicalLocation = {
  name: string;
  fullyQualifiedName?: string;
  kind?: string;
};

export type SarifResult = {
  ruleId: string;
  ruleIndex: number;
  level: SarifLevel;
  message: SarifMultiformatMessage;
  partialFingerprints: Record<string, string>;
  baselineState?: "new" | "unchanged" | "updated";
  locations?: SarifLocation[];
  properties?: Record<string, unknown>;
};

export type SarifRun = {
  tool: { driver: SarifToolComponent };
  results: SarifResult[];
  properties?: Record<string, unknown>;
};

export type SarifLog = {
  $schema: typeof SARIF_SCHEMA_URL;
  version: "2.1.0";
  runs: SarifRun[];
};

export type SarifGenerationInput = {
  product: {
    name: string;
    version: string;
    informationUri?: string;
  };
  findings: Finding[];
  resolvedFindings?: ResolvedFinding[];
  policyEvaluation?: PolicyEvaluationResult;
  baselineSummary?: BaselineSummary;
  comparisonCoverage?: ComparisonCoverage;
  execution?: {
    successful: boolean;
    projectNames?: string[];
  };
};

export type SarifGenerationOptions = {
  includeClassifiedFindings?: boolean;
  includeResolvedSummary?: boolean;
  repositoryRoot?: string;
};

export type SarifGenerationDiagnosticCode =
  | "missing-source-location"
  | "invalid-source-location"
  | "duplicate-rule"
  | "duplicate-result"
  | "unsupported-lifecycle"
  | "truncated-text";

export type SarifGenerationDiagnostic = {
  code: SarifGenerationDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
  fingerprint?: string;
  ruleId?: string;
};

export type SarifGenerationResult = {
  log: SarifLog;
  summary: {
    rules: number;
    results: number;
    locatedResults: number;
    unlocatedResults: number;
    classifiedResults: number;
    policyBreaches: number;
    resolvedFindings: number;
  };
  diagnostics: SarifGenerationDiagnostic[];
};

/** Optional source location attached to a finding for SARIF physical locations. */
export type FindingSourceLocation = {
  uri: string;
  startLine: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
};

export type FindingWithSource = Finding & {
  sourceLocation?: FindingSourceLocation;
};

export type SeverityRank = Severity;
