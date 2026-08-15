import type { Severity } from "./enums.js";
import type { FindingDisposition, FindingLocation, RegressionReason } from "./baseline.js";

/** CI policy flags accepted in a11yst configuration. */
export interface CiPolicyConfig {
  failOnNew?: boolean;
  failOnRegression?: boolean;
  failOnExpiredClassification?: boolean;
  minimumSeverity?: Severity;
}

/** Fully normalised CI policy after validation and defaults. */
export interface ResolvedCiPolicyConfig {
  failOnNew: boolean;
  failOnRegression: boolean;
  failOnExpiredClassification: boolean;
  minimumSeverity: Severity;
}

export const DEFAULT_CI_POLICY: ResolvedCiPolicyConfig = {
  failOnNew: false,
  failOnRegression: false,
  failOnExpiredClassification: false,
  minimumSeverity: "high",
};

export type PolicyEvaluationStatus = "passed" | "failed" | "not-evaluated";

export type PolicyBreachKind =
  | "new-finding"
  | "regressed-finding"
  | "expired-classification";

export type PolicyBreach = {
  kind: PolicyBreachKind;
  fingerprint: string;
  ruleId: string;
  severity: Severity;
  projectName: string;
  lifecycleStatus: "new" | "regressed";
  disposition?: FindingDisposition;
  reason?: RegressionReason;
  location: FindingLocation;
};

export type PolicyDiagnosticCode =
  | "policy-disabled"
  | "baseline-required"
  | "baseline-not-used"
  | "comparison-unavailable"
  | "coverage-incomplete"
  | "duplicate-fingerprint"
  | "unsupported-lifecycle";

export type PolicyDiagnosticLevel = "info" | "warning" | "error";

export type PolicyDiagnostic = {
  code: PolicyDiagnosticCode;
  level: PolicyDiagnosticLevel;
  message: string;
};

export type PolicyEvaluationSummary = {
  evaluatedFindings: number;
  ignoredBySeverity: number;
  excludedByDisposition: number;
  newBreaches: number;
  regressionBreaches: number;
  expiredClassificationBreaches: number;
  totalBreaches: number;
};

export type PolicyEvaluationResult = {
  status: PolicyEvaluationStatus;
  policyEnabled: boolean;
  baselineRequired: boolean;
  baselineUsed: boolean;
  breaches: PolicyBreach[];
  summary: PolicyEvaluationSummary;
  diagnostics: PolicyDiagnostic[];
};
