import type {
  BaselineSummary,
  ComparisonCoverage,
  Diagnostic,
  Finding,
  FindingDisposition,
  PolicyBreach,
  PolicyBreachKind,
  PolicyDiagnostic,
  PolicyEvaluationResult,
  PolicyEvaluationSummary,
  ResolvedCiPolicyConfig,
} from "@a11yst/types";
import { dedupeFindings } from "./dedupe.js";
import { isPolicyExcludedDisposition } from "./disposition.js";
import { findingLocation } from "./location.js";
import { compareSeverityDescending, isSeverityAtLeast } from "./severity.js";

export type PolicyEvaluationInput = {
  policy: ResolvedCiPolicyConfig;
  baselineUsed: boolean;
  findings: Finding[];
  baselineSummary?: BaselineSummary;
  comparisonCoverage?: ComparisonCoverage;
  diagnostics?: Diagnostic[];
};

const BREACH_KIND_ORDER: Record<PolicyBreachKind, number> = {
  "expired-classification": 0,
  "new-finding": 1,
  "regressed-finding": 2,
};

function isPolicyEnabled(policy: ResolvedCiPolicyConfig): boolean {
  return (
    policy.failOnNew ||
    policy.failOnRegression ||
    policy.failOnExpiredClassification
  );
}

function isExpiredClassificationFinding(finding: Finding): boolean {
  const baseline = finding.baseline;
  if (!baseline) return false;
  return (
    baseline.classificationExpired === true ||
    baseline.regressionReason === "classification-expired"
  );
}

function isExclusiveExpirationRegression(finding: Finding): boolean {
  const baseline = finding.baseline;
  if (!baseline || baseline.status !== "regressed") return false;
  return isExpiredClassificationFinding(finding);
}

function emptySummary(): PolicyEvaluationSummary {
  return {
    evaluatedFindings: 0,
    ignoredBySeverity: 0,
    excludedByDisposition: 0,
    newBreaches: 0,
    regressionBreaches: 0,
    expiredClassificationBreaches: 0,
    totalBreaches: 0,
  };
}

function diagnostic(
  code: PolicyDiagnostic["code"],
  level: PolicyDiagnostic["level"],
  message: string,
): PolicyDiagnostic {
  return { code, level, message };
}

function sortDiagnostics(items: PolicyDiagnostic[]): PolicyDiagnostic[] {
  return [...items].sort((a, b) => {
    const byCode = a.code.localeCompare(b.code);
    if (byCode !== 0) return byCode;
    return a.message.localeCompare(b.message);
  });
}

function sortBreaches(breaches: PolicyBreach[]): PolicyBreach[] {
  return [...breaches].sort((a, b) => {
    const bySeverity = compareSeverityDescending(a.severity, b.severity);
    if (bySeverity !== 0) return bySeverity;
    const byKind = BREACH_KIND_ORDER[a.kind] - BREACH_KIND_ORDER[b.kind];
    if (byKind !== 0) return byKind;
    const byProject = a.projectName.localeCompare(b.projectName);
    if (byProject !== 0) return byProject;
    const byRule = a.ruleId.localeCompare(b.ruleId);
    if (byRule !== 0) return byRule;
    return a.fingerprint.localeCompare(b.fingerprint);
  });
}

function buildBreach(
  finding: Finding,
  kind: PolicyBreachKind,
): PolicyBreach {
  const lifecycleStatus = finding.baseline!.status as "new" | "regressed";
  const breach: PolicyBreach = {
    kind,
    fingerprint: finding.fingerprint,
    ruleId: finding.ruleId,
    severity: finding.severity,
    projectName: finding.projectName,
    lifecycleStatus,
    location: findingLocation(finding),
  };

  const disposition = finding.baseline?.classification?.disposition;
  if (disposition) {
    breach.disposition = disposition;
  }

  const reason = finding.baseline?.regressionReason;
  if (reason) {
    breach.reason = reason;
  }

  return breach;
}

function coverageIncomplete(
  baselineSummary: BaselineSummary | undefined,
  comparisonCoverage: ComparisonCoverage | undefined,
): boolean {
  if (baselineSummary && baselineSummary.notComparedFindings > 0) {
    return true;
  }
  if (!comparisonCoverage) return false;
  return (
    comparisonCoverage.excludedProjects.length > 0 ||
    comparisonCoverage.failedRuns.length > 0 ||
    comparisonCoverage.skippedRuns.length > 0
  );
}

export function evaluateCiPolicy(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const policyEnabled = isPolicyEnabled(input.policy);
  const diagnostics: PolicyDiagnostic[] = [];

  if (!policyEnabled) {
    diagnostics.push(
      diagnostic(
        "policy-disabled",
        "info",
        "CI policy is disabled; no findings will fail the policy gate.",
      ),
    );
    return {
      status: "passed",
      policyEnabled: false,
      baselineRequired: false,
      baselineUsed: input.baselineUsed,
      breaches: [],
      summary: emptySummary(),
      diagnostics: sortDiagnostics(diagnostics),
    };
  }

  if (!input.baselineUsed) {
    diagnostics.push(
      diagnostic(
        "baseline-required",
        "error",
        "CI policy requires baseline comparison, but no baseline was used.",
      ),
      diagnostic(
        "baseline-not-used",
        "error",
        "Policy evaluation skipped because baseline comparison is unavailable.",
      ),
      diagnostic(
        "comparison-unavailable",
        "error",
        "Findings were not compared to a baseline; policy cannot be evaluated.",
      ),
    );
    return {
      status: "not-evaluated",
      policyEnabled: true,
      baselineRequired: true,
      baselineUsed: false,
      breaches: [],
      summary: emptySummary(),
      diagnostics: sortDiagnostics(diagnostics),
    };
  }

  if (coverageIncomplete(input.baselineSummary, input.comparisonCoverage)) {
    diagnostics.push(
      diagnostic(
        "coverage-incomplete",
        "warning",
        "Baseline comparison coverage is incomplete; not-compared baseline entries never produce policy breaches.",
      ),
    );
  }

  const deduped = dedupeFindings(input.findings);
  for (const fingerprint of deduped.duplicateFingerprints) {
    diagnostics.push(
      diagnostic(
        "duplicate-fingerprint",
        "warning",
        `Duplicate finding fingerprint "${fingerprint}" was deduplicated during policy evaluation.`,
      ),
    );
  }

  const summary = emptySummary();
  const breaches: PolicyBreach[] = [];
  const minimumSeverity = input.policy.minimumSeverity;

  for (const finding of deduped.findings) {
    const lifecycle = finding.baseline?.status;
    if (!lifecycle || lifecycle === "known") {
      continue;
    }

    if (lifecycle !== "new" && lifecycle !== "regressed") {
      diagnostics.push(
        diagnostic(
          "unsupported-lifecycle",
          "warning",
          `Finding "${finding.fingerprint}" has unsupported lifecycle "${lifecycle}" and was skipped.`,
        ),
      );
      continue;
    }

    summary.evaluatedFindings += 1;

    const disposition = finding.baseline?.classification?.disposition as
      | FindingDisposition
      | undefined;

    if (isPolicyExcludedDisposition(disposition)) {
      summary.excludedByDisposition += 1;
      continue;
    }

    const meetsSeverity = isSeverityAtLeast(finding.severity, minimumSeverity);
    const expired = isExpiredClassificationFinding(finding);
    const exclusiveExpiration = isExclusiveExpirationRegression(finding);

    let breachKind: PolicyBreachKind | undefined;

    if (
      input.policy.failOnExpiredClassification &&
      expired &&
      lifecycle === "regressed"
    ) {
      breachKind = "expired-classification";
    } else if (
      input.policy.failOnRegression &&
      lifecycle === "regressed" &&
      !(exclusiveExpiration && input.policy.failOnExpiredClassification)
    ) {
      breachKind = "regressed-finding";
    } else if (input.policy.failOnNew && lifecycle === "new") {
      breachKind = "new-finding";
    }

    if (!breachKind) {
      continue;
    }

    if (!meetsSeverity) {
      summary.ignoredBySeverity += 1;
      continue;
    }

    breaches.push(buildBreach(finding, breachKind));
  }

  const sortedBreaches = sortBreaches(breaches);
  for (const breach of sortedBreaches) {
    switch (breach.kind) {
      case "new-finding":
        summary.newBreaches += 1;
        break;
      case "regressed-finding":
        summary.regressionBreaches += 1;
        break;
      case "expired-classification":
        summary.expiredClassificationBreaches += 1;
        break;
      default:
        break;
    }
  }
  summary.totalBreaches = sortedBreaches.length;

  return {
    status: sortedBreaches.length === 0 ? "passed" : "failed",
    policyEnabled: true,
    baselineRequired: true,
    baselineUsed: true,
    breaches: sortedBreaches,
    summary,
    diagnostics: sortDiagnostics(diagnostics),
  };
}

export { isPolicyEnabled, isSeverityAtLeast, isPolicyExcludedDisposition };
