import { describe, expect, it } from "vitest";
import type { Finding } from "@a11yst/types";
import { createPresentationFixture } from "../../../fixtures/demo/presentation/sample-results.js";
import { createDemoSummary } from "../../../../examples/demo/a11yst-shop/scripts/presentation/index.mjs";

describe("demo presentation summary", () => {
  it("derives lifecycle counts from baseline summary and findings", () => {
    const results = createPresentationFixture();
    const summary = createDemoSummary(results, 2);

    expect(summary.findings.total).toBe(4);
    expect(summary.findings.known).toBe(1);
    expect(summary.findings.new).toBe(3);
    expect(summary.findings.regressed).toBe(0);
    expect(summary.findings.resolved).toBe(0);
    expect(summary.findings.notCompared).toBe(0);
  });

  it("counts interactive findings from flow and checkpoint metadata", () => {
    const results = createPresentationFixture();
    const summary = createDemoSummary(results, 2);
    expect(summary.findings.interactive).toBe(1);
  });

  it("does not count route-only findings as interactive", () => {
    const base = createPresentationFixture().findings[1] as Finding;
    const results = createPresentationFixture({
      findings: [
        {
          ...base,
          flowId: undefined,
          checkpointId: undefined,
        },
      ],
    });
    const summary = createDemoSummary(results, 0);
    expect(summary.findings.interactive).toBe(0);
  });

  it("derives source analysis counts from stored summary", () => {
    const summary = createDemoSummary(createPresentationFixture(), 2);
    expect(summary.sourceAnalysis.mapped).toBe(3);
    expect(summary.sourceAnalysis.ambiguous).toBe(0);
    expect(summary.sourceAnalysis.unmapped).toBe(1);
    expect(summary.sourceAnalysis.invalid).toBe(0);
  });

  it("counts findings with recommendations using recommendation status", () => {
    const summary = createDemoSummary(createPresentationFixture(), 2);
    expect(summary.recommendations.findingsWithRecommendations).toBe(2);
  });

  it("marks policy breach from exit code and evaluation status", () => {
    const summary = createDemoSummary(createPresentationFixture(), 2);
    expect(summary.policy.exitCode).toBe(2);
    expect(summary.policy.breached).toBe(true);
  });

  it("fail-soft when optional enrichment is absent", () => {
    const results = createPresentationFixture({
      sourceAnalysis: undefined,
      policyEvaluation: undefined,
      baselineSummary: undefined,
      findings: [
        {
          id: "plain",
          fingerprint: "plain",
          source: "axe",
          ruleId: "label",
          title: "Label",
          severity: "critical",
          projectName: "a11yst-shop",
          profile: "default",
          target: ["#x"],
          standards: [],
          baseline: { status: "new", baselineFingerprint: "plain", currentSeverity: "critical" },
        },
      ],
    });
    const summary = createDemoSummary(results, 0);
    expect(summary.sourceAnalysis.mapped).toBe(0);
    expect(summary.recommendations.findingsWithRecommendations).toBe(0);
    expect(summary.policy.breached).toBe(false);
  });
});

describe("demo presentation determinism", () => {
  it("produces identical summary objects for identical input", () => {
    const results = createPresentationFixture();
    expect(createDemoSummary(results, 2)).toEqual(createDemoSummary(results, 2));
  });
});
