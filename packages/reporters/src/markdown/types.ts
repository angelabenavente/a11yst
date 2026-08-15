import type {
  AuditProfileSummary,
  BaselineSummary,
  ComparisonCoverage,
  Finding,
  PolicyEvaluationResult,
  ResolvedFinding,
  Severity,
} from "@a11yst/types";

export type ReportReference = {
  path: string;
};

export type MarkdownAuditMetadata = {
  auditId?: string;
  project?: string;
  framework?: string;
  target?: string;
  startedAt?: string;
  routes?: string[];
  profiles?: string[];
  viewports?: string[];
  uniqueIssueGroups?: number;
  totalAffectedElements?: number;
  findingsBySeverity?: Partial<Record<Severity, number>>;
  profileSummary?: AuditProfileSummary;
  executionFailed?: boolean;
  failureMessages?: string[];
};

export type MarkdownReportInput = {
  product: {
    name: string;
    version: string;
  };
  audit: {
    successful: boolean;
  };
  metadata?: MarkdownAuditMetadata;
  findings: Finding[];
  resolvedFindings?: ResolvedFinding[];
  baselineSummary?: BaselineSummary;
  comparisonCoverage?: ComparisonCoverage;
  policyEvaluation?: PolicyEvaluationResult;
  policyMinimumSeverity?: Severity;
  reports?: {
    html?: ReportReference;
    sarif?: ReportReference;
    junit?: ReportReference;
    markdown?: ReportReference;
  };
};

export type MarkdownReportOptions = {
  title?: string;
  includeKnownFindings?: boolean;
  includeClassifications?: boolean;
  includeResolvedSummary?: boolean;
  maxDetailedFindings?: number;
};

export type MarkdownReportDiagnosticCode =
  | "truncated-findings"
  | "invalid-link"
  | "missing-policy-data"
  | "unsupported-lifecycle"
  | "redacted-content";

export type MarkdownReportDiagnostic = {
  code: MarkdownReportDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
};

export type MarkdownReportResult = {
  markdown: string;
  summary: {
    findings: number;
    newFindings: number;
    knownFindings: number;
    regressedFindings: number;
    resolvedFindings: number;
    notComparedFindings: number;
    policyBreaches: number;
    detailedFindings: number;
    truncatedFindings: number;
  };
  diagnostics: MarkdownReportDiagnostic[];
};
