import type {
  Finding,
  FindingBaselineState,
  FindingClassification,
  ResolvedCiPolicyConfig,
} from "@a11yst/types";
import { DEFAULT_CI_POLICY } from "@a11yst/types";

export const ENABLED_POLICY: ResolvedCiPolicyConfig = {
  failOnNew: true,
  failOnRegression: true,
  failOnExpiredClassification: true,
  minimumSeverity: "high",
};

export function policy(overrides: Partial<ResolvedCiPolicyConfig> = {}): ResolvedCiPolicyConfig {
  return { ...DEFAULT_CI_POLICY, ...overrides };
}

export function classification(
  overrides: Partial<FindingClassification> & Pick<FindingClassification, "disposition" | "reason">,
): FindingClassification {
  const { scope, ...rest } = overrides;
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    scope: scope ?? { type: "finding", fingerprint: "fp" },
    ...rest,
  };
}

export function baselineState(
  overrides: Partial<FindingBaselineState> & Pick<FindingBaselineState, "status">,
): FindingBaselineState {
  return {
    baselineFingerprint: overrides.baselineFingerprint ?? "fp",
    currentSeverity: overrides.currentSeverity ?? "high",
    ...overrides,
  };
}

export function finding(overrides: Partial<Finding> = {}): Finding {
  const fingerprint = overrides.fingerprint ?? "image-alt|site|/|default|desktop|#logo";
  return {
    id: overrides.id ?? `finding::${fingerprint}`,
    fingerprint,
    fingerprintVersion: "1",
    source: "axe",
    ruleId: overrides.ruleId ?? "image-alt",
    title: "Images must have alternate text",
    severity: overrides.severity ?? "high",
    projectName: overrides.projectName ?? "site",
    profile: overrides.profile ?? "default",
    viewport: overrides.viewport ?? "desktop",
    route: overrides.route ?? "/",
    url: "http://127.0.0.1/",
    target: ["#logo"],
    standards: [],
    html: '<img src="logo.png">',
    failureSummary: "Fix alt text",
    helpUrl: "https://example.com/rule",
    evidence: {
      screenshot: "/tmp/evidence/secret-page.png",
      pageScreenshot: "/tmp/evidence/page.png",
    },
    ...overrides,
  };
}

/** New serious route finding (default policy candidate). */
export function newSeriousRouteFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    severity: "high",
    baseline: baselineState({ status: "new", baselineFingerprint: "new-serious-route" }),
    fingerprint: "new-serious-route",
    ...overrides,
  });
}

/** Regressed critical flow-checkpoint finding. */
export function regressedCriticalFlowFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    severity: "critical",
    ruleId: "button-name",
    flowId: "checkout",
    checkpointId: "cart-ready",
    route: undefined,
    baseline: baselineState({
      status: "regressed",
      baselineFingerprint: "regressed-critical-flow",
      previousSeverity: "medium",
      currentSeverity: "critical",
      regressionReason: "severity-increased",
    }),
    fingerprint: "regressed-critical-flow",
    ...overrides,
  });
}

/** Expired accepted-risk finding (classification-expired regression). */
export function expiredAcceptedRiskFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    severity: "medium",
    ruleId: "label",
    target: ["#email"],
    baseline: baselineState({
      status: "regressed",
      baselineFingerprint: "expired-accepted-risk",
      classificationExpired: true,
      regressionReason: "classification-expired",
      classification: classification({
        disposition: "accepted-risk",
        reason: "Planned remediation",
        owner: "platform-team",
        expiresAt: "2026-01-01",
        scope: { type: "finding", fingerprint: "expired-accepted-risk" },
      }),
    }),
    fingerprint: "expired-accepted-risk",
    ...overrides,
  });
}

/** False-positive new finding (excluded from policy). */
export function falsePositiveFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    severity: "critical",
    baseline: baselineState({
      status: "new",
      baselineFingerprint: "false-positive-new",
      classification: classification({
        disposition: "false-positive",
        reason: "Decorative icon only",
        scope: { type: "finding", fingerprint: "false-positive-new" },
      }),
    }),
    fingerprint: "false-positive-new",
    ...overrides,
  });
}
