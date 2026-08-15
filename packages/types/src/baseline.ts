import type { AccessibilityProfile, AuditSource, Severity } from "./enums.js";
import type { AxeImpact } from "./severity.js";

/** Supported baseline schema version. */
export type BaselineSchemaVersion = "1";

/** Supported fingerprint version for baseline matching. */
export type FingerprintVersion = "1";

export const CURRENT_BASELINE_SCHEMA_VERSION: BaselineSchemaVersion = "1";
export const CURRENT_FINGERPRINT_VERSION: FingerprintVersion = "1";

export type FindingLifecycleStatus = "new" | "known" | "regressed" | "resolved";

export type NotComparedReason = "coverage-missing" | "not-compared";

export type RegressionReason =
  | "severity-increased"
  | "classification-expired"
  | "returned-after-resolution"
  | "confidence-increased"
  | "scope-expanded";

export type FindingDisposition =
  | "false-positive"
  | "accepted-risk"
  | "third-party"
  | "not-applicable"
  | "manual-review";

export type FindingLocation =
  | {
      kind: "route";
      route: string;
      routeId?: string;
      profile: AccessibilityProfile;
      viewport?: string;
    }
  | {
      kind: "flow-checkpoint";
      flowId: string;
      checkpointId: string;
      profile: AccessibilityProfile;
      viewport?: string;
    };

export type ClassificationScope =
  | {
      type: "finding";
      fingerprint: string;
    }
  | {
      type: "rule-location";
      ruleId: string;
      projectName: string;
      location: FindingLocation;
    };

export interface FindingClassification {
  disposition: FindingDisposition;
  reason: string;
  owner?: string;
  ticket?: string;
  createdAt: string;
  createdBy?: string;
  /** Calendar date in YYYY-MM-DD (UTC). Valid through end of this day. */
  expiresAt?: string;
  /** Calendar date in YYYY-MM-DD (UTC) for periodic third-party review. */
  reviewAt?: string;
  scope: ClassificationScope;
  notes?: string;
}

export type BaselineHistoryAction =
  | "created"
  | "classification-added"
  | "classification-updated"
  | "classification-removed"
  | "severity-increased"
  | "severity-decreased"
  | "accepted"
  | "resolved"
  | "reappeared";

export interface BaselineHistoryEntry {
  at: string;
  action: BaselineHistoryAction;
  details?: Record<string, string>;
}

export interface BaselineEntrySnapshot {
  title: string;
  target?: string[];
  route?: string;
  routeId?: string;
  flowId?: string;
  checkpointId?: string;
  profile: AccessibilityProfile;
  viewport?: string;
  adapterId?: string;
  framework?: string;
  confidence?: "low" | "medium" | "high";
}

export interface BaselineEntryLifecycle {
  lastStatus?: "known" | "resolved" | "regressed";
  resolvedAt?: string;
  reappearedAt?: string;
}

export interface BaselineEntry {
  fingerprint: string;
  fingerprintVersion: FingerprintVersion;
  ruleId: string;
  source: AuditSource;
  projectName: string;
  location: FindingLocation;
  severity: Severity;
  /** Raw axe-core impact preserved on baseline entries sourced from axe. */
  sourceImpact?: AxeImpact | null;
  firstSeenAt: string;
  lastSeenAt: string;
  snapshot: BaselineEntrySnapshot;
  classification?: FindingClassification;
  lifecycle?: BaselineEntryLifecycle;
  history?: BaselineHistoryEntry[];
}

export interface BaselineSourceCoverage {
  projects: string[];
  profiles: string[];
  viewports: string[];
  routeRuns: number;
  flowCheckpointRuns: number;
  skippedRuns: number;
}

export interface BaselineSourceAudit {
  auditId?: string;
  resultPath?: string;
  coverage?: BaselineSourceCoverage;
}

export interface BaselineFile {
  schemaVersion: BaselineSchemaVersion;
  fingerprintVersion: FingerprintVersion;
  createdAt: string;
  updatedAt: string;
  productVersion: string;
  sourceAudit?: BaselineSourceAudit;
  entries: BaselineEntry[];
}

export interface BaselineConfig {
  /** Path to baseline file relative to config directory. */
  file?: string;
  /** Compare against baseline during audit when present. */
  compare?: boolean;
  /** Apply stored classifications during comparison. */
  classifications?: boolean;
}

export interface ResolvedBaselineConfig {
  file: string;
  compare: boolean;
  classifications: boolean;
}

export interface ComparisonCoverage {
  comparedProjects: string[];
  comparedProfiles: string[];
  comparedViewports: string[];
  comparedRoutes: string[];
  comparedFlows: Array<{
    flowId: string;
    checkpointIds: string[];
  }>;
  excludedProjects: string[];
  failedRuns: string[];
  skippedRuns: string[];
}

export interface FindingBaselineState {
  status: "new" | "known" | "regressed";
  baselineFingerprint: string;
  previousSeverity?: Severity;
  currentSeverity?: Severity;
  classification?: FindingClassification;
  classificationExpired?: boolean;
  regressionReason?: RegressionReason;
}

export interface NotComparedFinding {
  fingerprint: string;
  ruleId: string;
  source: AuditSource;
  projectName: string;
  location: FindingLocation;
  severity: Severity;
  reason: NotComparedReason;
}

export interface ResolvedFinding {
  fingerprint: string;
  fingerprintVersion: FingerprintVersion;
  ruleId: string;
  source: AuditSource;
  projectName: string;
  location: FindingLocation;
  previousSeverity: Severity;
  classification?: FindingClassification;
  resolvedAt: string;
  snapshot?: BaselineEntrySnapshot;
}

export interface BaselineSummary {
  baselineUsed: boolean;
  baselinePath?: string;
  currentFindings: number;
  newFindings: number;
  knownFindings: number;
  regressedFindings: number;
  resolvedFindings: number;
  notComparedFindings: number;
  expiredClassifications: number;
  dispositions: {
    falsePositive: number;
    acceptedRisk: number;
    thirdParty: number;
    notApplicable: number;
    manualReview: number;
  };
}

export interface BaselineComparisonArtifact {
  schemaVersion: BaselineSchemaVersion;
  fingerprintVersion: FingerprintVersion;
  baselinePath: string;
  comparedAt: string;
  coverage: ComparisonCoverage;
  summary: BaselineSummary;
  new: Array<{
    fingerprint: string;
    ruleId: string;
    severity: Severity;
    projectName: string;
    location: FindingLocation;
  }>;
  known: Array<{ fingerprint: string; ruleId: string; severity: Severity }>;
  regressed: Array<{
    fingerprint: string;
    ruleId: string;
    severity: Severity;
    regressionReason: RegressionReason;
  }>;
  resolved: ResolvedFinding[];
  notCompared: NotComparedFinding[];
  expiredClassifications: Array<{
    fingerprint: string;
    disposition: FindingDisposition;
    expiresAt: string;
  }>;
  diagnostics: Array<{ code: string; message: string }>;
}
