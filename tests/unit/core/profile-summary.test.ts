import { describe, expect, it } from "vitest";
import { buildProfileSummary } from "@a11yst/core";
import type { AuditRunResult, Finding } from "@a11yst/types";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "id",
    fingerprint: "fp",
    source: "axe",
    ruleId: "rule",
    title: "title",
    severity: "medium",
    projectName: "website",
    profile: "default",
    target: [],
    standards: [],
    ...overrides,
  };
}

function run(overrides: Partial<AuditRunResult> = {}): AuditRunResult {
  return {
    runId: "run-1",
    projectName: "website",
    platform: "web",
    framework: "html",
    profile: "default",
    status: "completed",
    startedAt: new Date().toISOString(),
    durationMs: 10,
    findings: [],
    diagnostics: [],
    ...overrides,
  };
}

describe("buildProfileSummary", () => {
  it("counts completed, skipped, and failed profiles", () => {
    const summary = buildProfileSummary([
      run({ profile: "default", status: "completed" }),
      run({ profile: "keyboard", status: "completed" }),
      run({ profile: "large-text", status: "skipped" }),
      run({ profile: "reduced-motion", status: "failed" }),
    ]);

    expect(summary.completed).toEqual(["default", "keyboard"]);
    expect(summary.skipped).toEqual(["large-text"]);
    expect(summary.failed).toEqual(["reduced-motion"]);
  });

  it("ignores internal baseline runs when tallying profile status", () => {
    const summary = buildProfileSummary([
      run({ profile: "large-text", status: "completed", internalBaseline: true }),
      run({ profile: "large-text", status: "completed" }),
    ]);

    expect(summary.completed).toEqual(["large-text"]);
  });

  it("aggregates findings by source, automation, confidence, and manual review", () => {
    const summary = buildProfileSummary([
      run({
        profile: "keyboard",
        status: "completed",
        findings: [
          finding({
            source: "axe",
            automation: "automated",
            confidence: "high",
            fingerprint: "axe-1",
          }),
          finding({
            source: "a11yst",
            ruleId: "keyboard-positive-tabindex",
            automation: "heuristic",
            confidence: "medium",
            fingerprint: "a11yst-1",
          }),
          finding({
            source: "a11yst",
            ruleId: "reduced-motion-review",
            automation: "manual-review",
            confidence: "low",
            fingerprint: "manual-1",
          }),
        ],
      }),
    ]);

    expect(summary.findingsBySource).toEqual({ axe: 1, a11yst: 2 });
    expect(summary.findingsByAutomation).toEqual({
      automated: 1,
      heuristic: 1,
      "manual-review": 1,
    });
    expect(summary.findingsByConfidence).toEqual({
      high: 1,
      medium: 1,
      low: 1,
    });
    expect(summary.manualReviewPending).toBe(1);
  });

  it("collects run coverage entries", () => {
    const coverage = {
      profile: "keyboard" as const,
      status: "completed" as const,
      capabilities: ["axe", "keyboard-navigation"] as const,
      automatedChecks: ["focus sequence"],
      heuristicChecks: ["focus traps in initial state"],
      manualChecks: ["appropriateness of focus order"],
      limitations: ["Does not operate controls beyond focus traversal."],
      a11ystRulesExecuted: ["keyboard-positive-tabindex"],
      axeExecuted: true,
    };

    const summary = buildProfileSummary([
      run({
        profile: "keyboard",
        status: "completed",
        coverage,
      }),
    ]);

    expect(summary.coverage).toHaveLength(1);
    expect(summary.coverage[0]).toEqual(coverage);
  });
});
