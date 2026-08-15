import type {
  Finding,
  PolicyBreach,
  PolicyEvaluationResult,
  ResolvedFinding,
} from "@a11yst/types";
import type { MarkdownReportInput } from "@a11yst/reporters";

export const SECRET_TOKEN = "sk_live_a11yst_fixture_token_9f";
export const SECRET_PASSWORD = "P@ssw0rd-fixture-9f";

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
  overrides: Partial<PolicyEvaluationResult> & { breaches?: PolicyBreach[] } = {},
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

export function finding(overrides: Partial<Finding> = {}): Finding {
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

export function newFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    fingerprint: "button-name|storefront|/checkout|default|desktop|#submit",
    baseline: { status: "new", baselineFingerprint: "button-name|storefront|/checkout|default|desktop|#submit", currentSeverity: "high" },
    ...overrides,
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

export function regressedFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    fingerprint: "color-contrast|storefront|/checkout|default|desktop|#price",
    ruleId: "color-contrast",
    severity: "critical",
    baseline: {
      status: "regressed",
      baselineFingerprint: "color-contrast|storefront|/checkout|default|desktop|#price",
      currentSeverity: "critical",
    },
    ...overrides,
  });
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

export function baseInput(overrides: Partial<MarkdownReportInput> = {}): MarkdownReportInput {
  return {
    product: { name: "a11yst", version: "0.1.0" },
    audit: { successful: true },
    findings: [],
    ...overrides,
  };
}

export function completeComparisonInput(
  overrides: Partial<MarkdownReportInput> = {},
): MarkdownReportInput {
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

export function hostileFindingMetadata(): MarkdownReportInput {
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
