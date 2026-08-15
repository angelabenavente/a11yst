import { describe, expect, it } from "vitest";
import { createSarifInputFromAuditResult } from "@a11yst/core";
import type { AuditExecutionResult, Finding } from "@a11yst/types";

const finding: Finding = {
  id: "f-1",
  fingerprint: "fp-1",
  source: "axe",
  ruleId: "button-name",
  title: "Buttons must have discernible text",
  description: "Ensure buttons have accessible names.",
  severity: "high",
  route: "/checkout",
  projectName: "storefront",
  profile: "default",
  viewport: "desktop",
  target: ["#submit"],
  standards: ["wcag2a"],
};

function baseResult(overrides: Partial<AuditExecutionResult> = {}): AuditExecutionResult {
  return {
    schemaVersion: "1",
    status: "completed",
    summary: {
      status: "completed",
      startedAt: "2026-08-03T10:00:00.000Z",
      durationMs: 1,
      plannedRuns: 1,
      completedRuns: 1,
      skippedRuns: 0,
      failedRuns: 0,
      findingCount: 1,
      findingsBySeverity: { critical: 0, high: 1, medium: 0, minor: 0 },
    },
    plan: { projects: [], runs: [], totalRuns: 1, diagnostics: [], createdAt: "2026-08-03T10:00:00.000Z" },
    runs: [],
    findings: [finding],
    diagnostics: [],
    limitations: [],
    environment: {
      product: "a11yst",
      productVersion: "0.1.0",
      nodeVersion: "20.0.0",
      browser: "chromium",
      headed: false,
    },
    ...overrides,
  };
}

describe("createSarifInputFromAuditResult", () => {
  it("maps findings, policy, baseline, and product metadata", () => {
    const result = baseResult({
      policyEvaluation: {
        status: "failed",
        policyEnabled: true,
        baselineRequired: true,
        baselineUsed: true,
        summary: {
          evaluatedFindings: 1,
          ignoredBySeverity: 0,
          excludedByDisposition: 0,
          totalBreaches: 1,
          newBreaches: 1,
          regressionBreaches: 0,
          expiredClassificationBreaches: 0,
        },
        breaches: [{
          fingerprint: "fp-1",
          kind: "new-finding",
          ruleId: "button-name",
          severity: "high",
          projectName: "storefront",
          lifecycleStatus: "new",
          location: { kind: "route", route: "/checkout", profile: "default" },
        }],
        diagnostics: [],
      },
      baselineSummary: {
        baselineUsed: true,
        baselinePath: ".a11yst/baseline.json",
        currentFindings: 1,
        newFindings: 1,
        knownFindings: 0,
        regressedFindings: 0,
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
    });

    const input = createSarifInputFromAuditResult(result);
    expect(input.findings).toBe(result.findings);
    expect(input.policyEvaluation).toBe(result.policyEvaluation);
    expect(input.baselineSummary).toBe(result.baselineSummary);
    expect(input.comparisonCoverage).toBeDefined();
    expect(input.product).toEqual({ name: "a11yst", version: "0.1.0" });
  });

  it("accepts legacy results without optional metadata", () => {
    const input = createSarifInputFromAuditResult(baseResult());
    expect(input.policyEvaluation).toBeUndefined();
    expect(input.baselineSummary).toBeUndefined();
    expect(input.comparisonCoverage).toBeUndefined();
  });

  it("does not mutate the source result", () => {
    const result = baseResult();
    const clone = structuredClone(result);
    createSarifInputFromAuditResult(result);
    expect(result).toEqual(clone);
  });
});
