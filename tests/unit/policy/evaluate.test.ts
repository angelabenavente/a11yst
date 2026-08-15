import { describe, expect, it } from "vitest";
import { evaluateCiPolicy, dedupeFindings } from "@a11yst/policy";
import { DEFAULT_CI_POLICY } from "@a11yst/types";
import {
  baselineState,
  classification,
  expiredAcceptedRiskFinding,
  falsePositiveFinding,
  finding,
  newSeriousRouteFinding,
  policy,
  regressedCriticalFlowFinding,
} from "./fixtures.js";

describe("evaluateCiPolicy — disabled policy", () => {
  it("passes with zero breaches when all flags are false", () => {
    const result = evaluateCiPolicy({
      policy: DEFAULT_CI_POLICY,
      baselineUsed: false,
      findings: [newSeriousRouteFinding(), regressedCriticalFlowFinding()],
    });

    expect(result.status).toBe("passed");
    expect(result.policyEnabled).toBe(false);
    expect(result.breaches).toEqual([]);
    expect(result.summary.totalBreaches).toBe(0);
    expect(result.diagnostics.some((item) => item.code === "policy-disabled")).toBe(true);
  });
});

describe("evaluateCiPolicy — baseline required", () => {
  it("returns not-evaluated when failOnNew is enabled without baseline", () => {
    const result = evaluateCiPolicy({
      policy: policy({ failOnNew: true }),
      baselineUsed: false,
      findings: [newSeriousRouteFinding()],
    });

    expect(result.status).toBe("not-evaluated");
    expect(result.policyEnabled).toBe(true);
    expect(result.baselineRequired).toBe(true);
    expect(result.breaches).toEqual([]);
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      "baseline-not-used",
      "baseline-required",
      "comparison-unavailable",
    ]);
  });

  it("does not treat findings as new without baseline comparison", () => {
    const result = evaluateCiPolicy({
      policy: policy({ failOnNew: true, failOnRegression: true, failOnExpiredClassification: true }),
      baselineUsed: false,
      findings: [
        newSeriousRouteFinding(),
        regressedCriticalFlowFinding(),
        expiredAcceptedRiskFinding(),
      ],
    });

    expect(result.status).toBe("not-evaluated");
    expect(result.summary.totalBreaches).toBe(0);
  });
});

describe("evaluateCiPolicy — new findings", () => {
  it("breaches new serious findings when failOnNew is enabled", () => {
    const target = newSeriousRouteFinding();
    const result = evaluateCiPolicy({
      policy: policy({ failOnNew: true, minimumSeverity: "high" }),
      baselineUsed: true,
      findings: [target],
    });

    expect(result.status).toBe("failed");
    expect(result.breaches).toHaveLength(1);
    expect(result.breaches[0]).toMatchObject({
      kind: "new-finding",
      fingerprint: target.fingerprint,
      lifecycleStatus: "new",
    });
    expect(result.summary.newBreaches).toBe(1);
  });

  it("ignores new findings below minimumSeverity", () => {
    const result = evaluateCiPolicy({
      policy: policy({ failOnNew: true, minimumSeverity: "high" }),
      baselineUsed: true,
      findings: [
        finding({
          severity: "minor",
          baseline: baselineState({ status: "new", baselineFingerprint: "minor-new" }),
          fingerprint: "minor-new",
        }),
      ],
    });

    expect(result.status).toBe("passed");
    expect(result.summary.ignoredBySeverity).toBe(1);
  });

  it("excludes false-positive and not-applicable new findings", () => {
    const result = evaluateCiPolicy({
      policy: policy({ failOnNew: true }),
      baselineUsed: true,
      findings: [
        falsePositiveFinding(),
        finding({
          severity: "critical",
          baseline: baselineState({
            status: "new",
            baselineFingerprint: "na-new",
            classification: classification({
              disposition: "not-applicable",
              reason: "Rule does not apply",
              scope: { type: "finding", fingerprint: "na-new" },
            }),
          }),
          fingerprint: "na-new",
        }),
      ],
    });

    expect(result.breaches).toEqual([]);
    expect(result.summary.excludedByDisposition).toBe(2);
  });

  it("does not exclude accepted-risk, third-party, or manual-review new findings", () => {
    const accepted = finding({
      severity: "high",
      baseline: baselineState({
        status: "new",
        baselineFingerprint: "accepted-new",
        classification: classification({
          disposition: "accepted-risk",
          reason: "Tracked",
          owner: "team",
          expiresAt: "2099-12-31",
          scope: { type: "finding", fingerprint: "accepted-new" },
        }),
      }),
      fingerprint: "accepted-new",
    });

    const result = evaluateCiPolicy({
      policy: policy({ failOnNew: true }),
      baselineUsed: true,
      findings: [accepted],
    });

    expect(result.breaches).toHaveLength(1);
    expect(result.breaches[0]?.disposition).toBe("accepted-risk");
  });

  it("never breaches known, resolved, or not-compared lifecycle states", () => {
    const result = evaluateCiPolicy({
      policy: policy({ failOnNew: true, failOnRegression: true }),
      baselineUsed: true,
      findings: [
        finding({
          severity: "critical",
          baseline: baselineState({ status: "known", baselineFingerprint: "known-1" }),
          fingerprint: "known-1",
        }),
      ],
    });

    expect(result.breaches).toEqual([]);
    expect(result.summary.evaluatedFindings).toBe(0);
  });
});

describe("evaluateCiPolicy — regressions", () => {
  it("breaches regressed serious findings when failOnRegression is enabled", () => {
    const target = regressedCriticalFlowFinding({ severity: "high" });
    const result = evaluateCiPolicy({
      policy: policy({ failOnRegression: true, minimumSeverity: "high" }),
      baselineUsed: true,
      findings: [target],
    });

    expect(result.status).toBe("failed");
    expect(result.breaches[0]).toMatchObject({
      kind: "regressed-finding",
      reason: "severity-increased",
      lifecycleStatus: "regressed",
    });
    expect(result.breaches[0]?.location).toMatchObject({
      kind: "flow-checkpoint",
      flowId: "checkout",
      checkpointId: "cart-ready",
    });
  });

  it("supports returned-after-resolution and scope-expanded regression reasons", () => {
    for (const reason of ["returned-after-resolution", "scope-expanded", "confidence-increased"] as const) {
      const result = evaluateCiPolicy({
        policy: policy({ failOnRegression: true }),
        baselineUsed: true,
        findings: [
          finding({
            severity: "high",
            baseline: baselineState({
              status: "regressed",
              baselineFingerprint: reason,
              regressionReason: reason,
            }),
            fingerprint: reason,
          }),
        ],
      });
      expect(result.breaches[0]?.reason).toBe(reason);
    }
  });
});

describe("evaluateCiPolicy — expired classifications", () => {
  it("breaches expired accepted-risk regressions when enabled", () => {
    const target = expiredAcceptedRiskFinding();
    const result = evaluateCiPolicy({
      policy: policy({ failOnExpiredClassification: true, minimumSeverity: "medium" }),
      baselineUsed: true,
      findings: [target],
    });

    expect(result.breaches).toHaveLength(1);
    expect(result.breaches[0]).toMatchObject({
      kind: "expired-classification",
      disposition: "accepted-risk",
    });
    expect(result.summary.expiredClassificationBreaches).toBe(1);
  });

  it("prefers expired-classification over regressed-finding for expiration-only regressions", () => {
    const target = expiredAcceptedRiskFinding();
    const result = evaluateCiPolicy({
      policy: policy({
        failOnRegression: true,
        failOnExpiredClassification: true,
        minimumSeverity: "medium",
      }),
      baselineUsed: true,
      findings: [target],
    });

    expect(result.breaches).toHaveLength(1);
    expect(result.breaches[0]?.kind).toBe("expired-classification");
    expect(result.summary.regressionBreaches).toBe(0);
    expect(result.summary.expiredClassificationBreaches).toBe(1);
    expect(result.summary.totalBreaches).toBe(1);
  });

  it("still counts severity-increased regressions separately from expiry", () => {
    const result = evaluateCiPolicy({
      policy: policy({
        failOnRegression: true,
        failOnExpiredClassification: true,
      }),
      baselineUsed: true,
      findings: [regressedCriticalFlowFinding()],
    });

    expect(result.breaches).toHaveLength(1);
    expect(result.breaches[0]?.kind).toBe("regressed-finding");
  });
});

describe("evaluateCiPolicy — coverage diagnostics", () => {
  it("warns when baseline summary reports not-compared findings", () => {
    const result = evaluateCiPolicy({
      policy: policy({ failOnNew: true }),
      baselineUsed: true,
      findings: [],
      baselineSummary: {
        baselineUsed: true,
        currentFindings: 0,
        newFindings: 0,
        knownFindings: 0,
        regressedFindings: 0,
        resolvedFindings: 0,
        notComparedFindings: 2,
        expiredClassifications: 0,
        dispositions: {
          falsePositive: 0,
          acceptedRisk: 0,
          thirdParty: 0,
          notApplicable: 0,
          manualReview: 0,
        },
      },
    });

    expect(result.diagnostics.some((item) => item.code === "coverage-incomplete")).toBe(true);
  });
});

describe("dedupeFindings", () => {
  it("keeps the higher-severity duplicate and emits diagnostics through evaluateCiPolicy", () => {
    const low = newSeriousRouteFinding({ severity: "high", fingerprint: "dup-fp" });
    const high = newSeriousRouteFinding({ severity: "critical", fingerprint: "dup-fp" });

    const deduped = dedupeFindings([low, high]);
    expect(deduped.findings).toHaveLength(1);
    expect(deduped.findings[0]?.severity).toBe("critical");

    const result = evaluateCiPolicy({
      policy: policy({ failOnNew: true }),
      baselineUsed: true,
      findings: [low, high],
    });
    expect(result.diagnostics.some((item) => item.code === "duplicate-fingerprint")).toBe(true);
    expect(result.breaches[0]?.severity).toBe("critical");
  });

  it("prefers regressed lifecycle over new for the same fingerprint", () => {
    const deduped = dedupeFindings([
      newSeriousRouteFinding({ fingerprint: "dup-lifecycle" }),
      finding({
        severity: "high",
        fingerprint: "dup-lifecycle",
        baseline: baselineState({
          status: "regressed",
          baselineFingerprint: "dup-lifecycle",
          regressionReason: "severity-increased",
        }),
      }),
    ]);

    expect(deduped.findings[0]?.baseline?.status).toBe("regressed");
  });
});

describe("evaluateCiPolicy — determinism and immutability", () => {
  it("returns identical results for shuffled input", () => {
    const findings = [
      newSeriousRouteFinding({ fingerprint: "b" }),
      regressedCriticalFlowFinding({ fingerprint: "a", severity: "high" }),
      falsePositiveFinding(),
    ];
    const input = {
      policy: policy({ failOnNew: true, failOnRegression: true }),
      baselineUsed: true,
      findings,
    };

    const forward = evaluateCiPolicy(input);
    const reverse = evaluateCiPolicy({ ...input, findings: [...findings].reverse() });

    expect(reverse).toEqual(forward);
  });

  it("does not mutate the findings array or nested baseline objects", () => {
    const findings = [newSeriousRouteFinding()];
    const snapshot = structuredClone(findings);
    evaluateCiPolicy({
      policy: policy({ failOnNew: true }),
      baselineUsed: true,
      findings,
    });
    expect(findings).toEqual(snapshot);
  });
});

describe("evaluateCiPolicy — sensitive data minimization", () => {
  it("omits html, evidence, and secrets from breaches", () => {
    const sensitive = finding({
      html: "<input value='secret-password'>",
      failureSummary: "token=abc123",
      baseline: baselineState({ status: "new", baselineFingerprint: "sensitive" }),
      fingerprint: "sensitive",
    });

    const result = evaluateCiPolicy({
      policy: policy({ failOnNew: true }),
      baselineUsed: true,
      findings: [sensitive],
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("secret-password");
    expect(serialized).not.toContain("token=abc123");
    expect(serialized).not.toContain("/tmp/evidence");
    expect(result.breaches[0]).not.toHaveProperty("html");
    expect(result.breaches[0]).not.toHaveProperty("evidence");
  });
});
