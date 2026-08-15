import type {
  AuditRunResult,
  Finding,
  PolicyBreach,
  PolicyEvaluationResult,
  ResolvedFinding,
} from "@a11yst/types";
import type { JunitGenerationInput } from "@a11yst/junit";
import { run as baselineRun, flowRun } from "../baseline/fixtures.js";

export const SECRET_TOKEN = "sk_live_allyst_fixture_token_9c";
export const SECRET_PASSWORD = "P@ssw0rd-fixture-9c";

export function completedRouteRun(overrides: Partial<AuditRunResult> = {}): AuditRunResult {
  return baselineRun({
    projectName: "storefront",
    route: "/checkout",
    profile: "default",
    status: "completed",
    durationMs: 1250,
    ...overrides,
  });
}

export function skippedExpoRun(overrides: Partial<AuditRunResult> = {}): AuditRunResult {
  return baselineRun({
    projectName: "mobile",
    framework: "expo",
    route: "/home",
    profile: "default",
    status: "skipped",
    skipReason: "Expo dev server was not reachable.",
    durationMs: 0,
    ...overrides,
  });
}

export function failedRouteRun(overrides: Partial<AuditRunResult> = {}): AuditRunResult {
  return baselineRun({
    projectName: "storefront",
    route: "/settings",
    profile: "keyboard",
    status: "failed",
    durationMs: 500,
    diagnostics: [
      {
        code: "navigation-timeout",
        severity: "error",
        message: "Timed out waiting for route readiness.",
      },
    ],
    ...overrides,
  });
}

export function completedFlowCheckpoint(overrides: Partial<AuditRunResult> = {}): AuditRunResult {
  return flowRun({
    projectName: "storefront",
    flowId: "checkout",
    checkpointId: "payment-dialog-open",
    profile: "keyboard",
    status: "completed",
    durationMs: 800,
    ...overrides,
  });
}

export function newPolicyBreach(overrides: Partial<PolicyBreach> = {}): PolicyBreach {
  return {
    kind: "new-finding",
    fingerprint: "button-name|storefront|/checkout|default|desktop|#submit",
    ruleId: "button-name",
    severity: "high",
    projectName: "storefront",
    lifecycleStatus: "new",
    location: {
      kind: "route",
      route: "/checkout",
      profile: "default",
      viewport: "desktop",
    },
    ...overrides,
  };
}

export function regressionPolicyBreach(overrides: Partial<PolicyBreach> = {}): PolicyBreach {
  return {
    kind: "regressed-finding",
    fingerprint: "color-contrast|storefront|/checkout|default|desktop|#price",
    ruleId: "color-contrast",
    severity: "critical",
    projectName: "storefront",
    lifecycleStatus: "regressed",
    reason: "severity-increased",
    location: {
      kind: "route",
      route: "/checkout",
      profile: "default",
      viewport: "desktop",
    },
    ...overrides,
  };
}

export function expiredPolicyBreach(overrides: Partial<PolicyBreach> = {}): PolicyBreach {
  return {
    kind: "expired-classification",
    fingerprint: "label|storefront|/checkout|default|desktop|#email",
    ruleId: "label",
    severity: "medium",
    projectName: "storefront",
    lifecycleStatus: "regressed",
    reason: "classification-expired",
    location: {
      kind: "route",
      route: "/checkout",
      profile: "default",
      viewport: "desktop",
    },
    ...overrides,
  };
}

export function policyEvaluation(
  overrides: Partial<PolicyEvaluationResult> & {
    breaches?: PolicyBreach[];
  } = {},
): PolicyEvaluationResult {
  const breaches = overrides.breaches ?? [];
  const policyEnabled = overrides.policyEnabled ?? breaches.length > 0;
  return {
    status: overrides.status ?? (breaches.length > 0 ? "failed" : "passed"),
    policyEnabled,
    baselineRequired: policyEnabled,
    baselineUsed: true,
    breaches,
    summary: {
      evaluatedFindings: 1,
      ignoredBySeverity: 0,
      excludedByDisposition: 0,
      newBreaches: breaches.filter((b) => b.kind === "new-finding").length,
      regressionBreaches: breaches.filter((b) => b.kind === "regressed-finding").length,
      expiredClassificationBreaches: breaches.filter((b) => b.kind === "expired-classification")
        .length,
      totalBreaches: breaches.length,
    },
    diagnostics: overrides.diagnostics ?? [],
    ...overrides,
  };
}

export function policyNotEvaluated(
  overrides: Partial<PolicyEvaluationResult> = {},
): PolicyEvaluationResult {
  return policyEvaluation({
    status: "not-evaluated",
    policyEnabled: true,
    breaches: [],
    diagnostics: [
      {
        code: "baseline-not-used",
        level: "error",
        message: "Baseline comparison was unavailable for policy evaluation.",
      },
    ],
    ...overrides,
  });
}

export function hostileFindingMetadata(): JunitGenerationInput {
  return baseInput({
    findings: [
      finding({
        html: `<input type="password" value="${SECRET_PASSWORD}">`,
        failureSummary: `Authorization: Bearer ${SECRET_TOKEN}`,
        evidence: {
          screenshot: `/tmp/${SECRET_TOKEN}.png`,
        },
      }),
    ],
  });
}

export function knownFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    baseline: {
      status: "known",
      baselineFingerprint: "known-fp",
      currentSeverity: "high",
    },
    fingerprint: "known-fp",
    ...overrides,
  });
}

export function resolvedFindingEntry(): ResolvedFinding {
  return {
    fingerprint: "resolved-fp",
    fingerprintVersion: "1",
    ruleId: "button-name",
    source: "axe",
    projectName: "storefront",
    location: {
      kind: "route",
      route: "/old",
      profile: "default",
    },
    previousSeverity: "high",
    resolvedAt: "2026-01-01T00:00:00.000Z",
  };
}

export function notComparedFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    baseline: {
      status: "known",
      baselineFingerprint: "not-compared-fp",
      currentSeverity: "high",
    },
    fingerprint: "not-compared-fp",
    ...overrides,
  });
}

export function baseInput(overrides: Partial<JunitGenerationInput> = {}): JunitGenerationInput {
  return {
    product: { name: "a11yst", version: "0.1.0" },
    audit: { successful: true, durationMs: 1000 },
    findings: [],
    ...overrides,
  };
}

export function completeComparisonInput(
  overrides: Partial<JunitGenerationInput> = {},
): JunitGenerationInput {
  const findings = overrides.findings ?? [];
  return baseInput({
    findings,
    baselineSummary: {
      baselineUsed: true,
      baselinePath: ".a11yst/baseline.json",
      currentFindings: findings.length,
      newFindings: findings.filter((f) => f.baseline?.status === "new").length,
      knownFindings: findings.filter((f) => f.baseline?.status === "known").length,
      regressedFindings: findings.filter((f) => f.baseline?.status === "regressed").length,
      resolvedFindings: 0,
      notComparedFindings: overrides.baselineSummary?.notComparedFindings ?? 1,
      expiredClassifications: 0,
      dispositions: {
        falsePositive: 0,
        acceptedRisk: 0,
        thirdParty: 0,
        notApplicable: 0,
        manualReview: 0,
      },
    },
    comparisonCoverage: {
      comparedProjects: ["storefront"],
      comparedProfiles: ["default"],
      comparedViewports: ["desktop"],
      comparedRoutes: ["/checkout"],
      comparedFlows: [],
      excludedProjects: [],
      failedRuns: [],
      skippedRuns: [],
    },
    ...overrides,
  });
}

function finding(overrides: Partial<Finding>): Finding {
  return {
    id: "finding-id",
    fingerprint: "fp-default",
    fingerprintVersion: "1",
    source: "axe",
    ruleId: "button-name",
    title: "Buttons must have discernible text",
    severity: "high",
    projectName: "storefront",
    profile: "default",
    viewport: "desktop",
    route: "/checkout",
    target: ["#submit"],
    standards: [],
    ...overrides,
  };
}
