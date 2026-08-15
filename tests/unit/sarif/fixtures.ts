import type {
  Finding,
  PolicyEvaluationResult,
  ResolvedCiPolicyConfig,
} from "@a11yst/types";
import type { FindingSourceLocation, SarifGenerationInput } from "@a11yst/sarif";

const SECRET_TOKEN = "sk_live_a11yst_fixture_token_9c";
const SECRET_PASSWORD = "P@ssw0rd-fixture-9c";

export function axeRouteFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    source: "axe",
    ruleId: "button-name",
    title: "Buttons must have discernible text",
    description: "Ensure buttons have accessible names.",
    severity: "high",
    route: "/checkout",
    url: "http://127.0.0.1/checkout",
    target: ["#submit"],
    standards: ["wcag2a", "wcag2aa"],
    automation: "automated",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.10/button-name",
    fingerprint: "button-name|storefront|/checkout|default|desktop|#submit",
    baseline: baselineState({ status: "new" }),
    ...overrides,
  });
}

export function a11ystFlowFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    source: "a11yst",
    ruleId: "keyboard-trap",
    title: "Keyboard focus may be trapped",
    severity: "medium",
    flowId: "checkout",
    checkpointId: "payment-dialog-open",
    route: undefined,
    profile: "keyboard",
    confidence: "medium",
    automation: "heuristic",
    standards: ["wcag2aa"],
    fingerprint: "keyboard-trap|storefront|checkout|payment-dialog-open|keyboard|desktop",
    baseline: baselineState({ status: "known" }),
    ...overrides,
  });
}

export function regressedCriticalFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    severity: "critical",
    ruleId: "color-contrast",
    title: "Elements must have sufficient color contrast",
    baseline: baselineState({
      status: "regressed",
      regressionReason: "severity-increased",
      previousSeverity: "high",
      currentSeverity: "critical",
    }),
    fingerprint: "color-contrast|storefront|/checkout|default|desktop|#price",
    ...overrides,
  });
}

export function expiredAcceptedRiskFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    severity: "medium",
    ruleId: "label",
    baseline: baselineState({
      status: "regressed",
      classificationExpired: true,
      regressionReason: "classification-expired",
      classification: classification({
        disposition: "accepted-risk",
        owner: "checkout-team",
        expiresAt: "2026-01-01",
      }),
    }),
    fingerprint: "label|storefront|/checkout|default|desktop|#email",
    ...overrides,
  });
}

export function falsePositiveFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    severity: "critical",
    ruleId: "image-alt",
    baseline: baselineState({
      status: "known",
      classification: classification({ disposition: "false-positive" }),
    }),
    fingerprint: "image-alt|storefront|/|default|desktop|#logo",
    ...overrides,
  });
}

export function findingWithSourceLocation(
  overrides: Partial<Finding> & { sourceLocation?: FindingSourceLocation } = {},
): Finding & { sourceLocation: FindingSourceLocation } {
  const sourceLocation = overrides.sourceLocation ?? {
    uri: "src/components/CheckoutButton.tsx",
    startLine: 42,
    startColumn: 3,
  };
  return {
    ...axeRouteFinding(),
    ...overrides,
    sourceLocation,
  };
}

export function findingWithoutSourceLocation(overrides: Partial<Finding> = {}): Finding {
  return axeRouteFinding(overrides);
}

export function hostileFinding(): Finding & { sourceLocation?: FindingSourceLocation } {
  return {
    ...axeRouteFinding({
      title: "Accessible name missing",
      html: `<form><input type="password" value="${SECRET_PASSWORD}"></form>`,
      failureSummary: `Authorization: Bearer ${SECRET_TOKEN}`,
      target: ["#x".repeat(400)],
    }),
    sourceLocation: {
      uri: "/etc/passwd",
      startLine: 0,
    },
  };
}

export function baseInput(
  overrides: Partial<SarifGenerationInput> = {},
): SarifGenerationInput {
  return {
    product: { name: "a11yst", version: "0.1.0" },
    findings: [],
    ...overrides,
  };
}

export function completeComparisonInput(
  findings: Finding[],
  overrides: Partial<SarifGenerationInput> = {},
): SarifGenerationInput {
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
      notComparedFindings: 0,
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

export function policyEvaluation(
  overrides: Partial<ResolvedCiPolicyConfig> & {
    status?: PolicyEvaluationResult["status"];
    breaches?: PolicyEvaluationResult["breaches"];
  } = {},
): PolicyEvaluationResult {
  const enabled = Boolean(
    overrides.failOnNew ||
      overrides.failOnRegression ||
      overrides.failOnExpiredClassification,
  );
  const breaches = overrides.breaches ?? [];
  return {
    status: overrides.status ?? (breaches.length > 0 ? "failed" : "passed"),
    policyEnabled: enabled,
    baselineRequired: enabled,
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
    diagnostics: [],
  };
}

function finding(overrides: Partial<Finding>): Finding {
  return {
    id: "finding-id",
    fingerprint: "fp-default",
    fingerprintVersion: "1",
    source: "axe",
    ruleId: "rule",
    title: "Finding title",
    severity: "high",
    projectName: "storefront",
    profile: "default",
    viewport: "desktop",
    route: "/",
    target: ["#x"],
    standards: [],
    ...overrides,
  };
}

function baselineState(
  overrides: Partial<NonNullable<Finding["baseline"]>> = {},
): NonNullable<Finding["baseline"]> {
  return {
    status: "new",
    baselineFingerprint: "fp-default",
    currentSeverity: "high",
    ...overrides,
  };
}

function classification(
  overrides: Partial<NonNullable<NonNullable<Finding["baseline"]>["classification"]>>,
): NonNullable<NonNullable<Finding["baseline"]>["classification"]> {
  return {
    disposition: "accepted-risk",
    reason: "Documented exception",
    createdAt: "2026-01-01T00:00:00.000Z",
    scope: { type: "finding", fingerprint: "fp-default" },
    ...overrides,
  };
}

export { SECRET_TOKEN, SECRET_PASSWORD };
