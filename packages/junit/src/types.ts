import type {
  AuditRunResult,
  BaselineSummary,
  ComparisonCoverage,
  Finding,
  PolicyEvaluationResult,
  ResolvedFinding,
  Severity,
} from "@a11yst/types";

export type JunitProperty = {
  name: string;
  value: string;
};

export type JunitFailure = {
  type: string;
  message: string;
  content?: string;
};

export type JunitError = {
  type: string;
  message: string;
  content?: string;
};

export type JunitSkipped = {
  message: string;
};

export type JunitTestCase = {
  name: string;
  classname: string;
  time?: number;
  failure?: JunitFailure;
  error?: JunitError;
  skipped?: JunitSkipped;
  properties?: JunitProperty[];
  /** Internal dedupe key fragment; not serialized. */
  fingerprint?: string;
};

export type JunitTestSuite = {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
  properties?: JunitProperty[];
  testcases: JunitTestCase[];
};

export type JunitTestSuites = {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
  properties?: JunitProperty[];
  suites: JunitTestSuite[];
};

export type JunitGenerationInput = {
  product: {
    name: string;
    version: string;
  };
  audit: {
    id?: string;
    successful: boolean;
    durationMs?: number;
  };
  findings: Finding[];
  resolvedFindings?: ResolvedFinding[];
  runs?: AuditRunResult[];
  baselineSummary?: BaselineSummary;
  comparisonCoverage?: ComparisonCoverage;
  policyEvaluation?: PolicyEvaluationResult;
  policyMinimumSeverity?: Severity;
};

export type JunitGenerationOptions = {
  suiteName?: string;
  includePassingRunCases?: boolean;
  includeSkippedRunCases?: boolean;
  includeKnownFindingProperties?: boolean;
};

export type JunitGenerationDiagnosticCode =
  | "invalid-duration"
  | "duplicate-testcase"
  | "missing-run-metadata"
  | "unsupported-status"
  | "truncated-output";

export type JunitGenerationDiagnostic = {
  code: JunitGenerationDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
};

export type JunitGenerationResult = {
  document: JunitTestSuites;
  summary: {
    suites: number;
    tests: number;
    failures: number;
    errors: number;
    skipped: number;
    timeSeconds: number;
  };
  diagnostics: JunitGenerationDiagnostic[];
};
