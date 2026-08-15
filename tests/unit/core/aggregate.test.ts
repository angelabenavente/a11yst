import { describe, expect, it } from "vitest";
import { aggregateSummary, emptySeverityCounts, sortRunResults } from "@a11yst/core";
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

describe("emptySeverityCounts", () => {
  it("returns all-zero counts for every severity", () => {
    expect(emptySeverityCounts()).toEqual({
      critical: 0,
      high: 0,      medium: 0,
      minor: 0,
    });
  });

  it("returns a fresh object each call (no shared mutable state)", () => {
    const a = emptySeverityCounts();
    const b = emptySeverityCounts();
    a.critical = 5;
    expect(b.critical).toBe(0);
  });
});

describe("aggregateSummary", () => {
  const startedAt = new Date(Date.now() - 1000).toISOString();

  it("counts completed, skipped, and failed runs", () => {
    const runs = [
      run({ status: "completed" }),
      run({ status: "completed" }),
      run({ status: "skipped" }),
      run({ status: "failed" }),
    ];
    const summary = aggregateSummary(runs, startedAt);
    expect(summary.completedRuns).toBe(2);
    expect(summary.skippedRuns).toBe(1);
    expect(summary.failedRuns).toBe(1);
    expect(summary.plannedRuns).toBe(4);
  });

  it("reports zero findings and all-zero severity counts when there are none", () => {
    const summary = aggregateSummary([run({ status: "completed", findings: [] })], startedAt);
    expect(summary.findingCount).toBe(0);
    expect(summary.findingsBySeverity).toEqual(emptySeverityCounts());
  });

  it("counts findings by severity across all runs", () => {
    const runs = [
      run({
        status: "completed",
        findings: [finding({ severity: "critical" }), finding({ severity: "medium" })],
      }),
      run({
        status: "completed",
        findings: [finding({ severity: "critical" }), finding({ severity: "minor" })],
      }),
    ];
    const summary = aggregateSummary(runs, startedAt);
    expect(summary.findingCount).toBe(4);
    expect(summary.findingsBySeverity).toEqual({
      critical: 2,
      high: 0,      medium: 1,
      minor: 1,
    });
  });

  it("status is 'completed' when there are no failed runs, even with findings or skips", () => {
    const runs = [
      run({ status: "completed", findings: [finding({ severity: "critical" })] }),
      run({ status: "skipped" }),
    ];
    expect(aggregateSummary(runs, startedAt).status).toBe("completed");
  });

  it("status is 'completed-with-errors' when at least one run completed and at least one failed", () => {
    const runs = [run({ status: "completed" }), run({ status: "failed" })];
    expect(aggregateSummary(runs, startedAt).status).toBe("completed-with-errors");
  });

  it("status is 'failed' when one or more runs failed and none completed", () => {
    const runs = [run({ status: "failed" }), run({ status: "skipped" })];
    expect(aggregateSummary(runs, startedAt).status).toBe("failed");
  });

  it("status is 'failed' for an all-failed batch", () => {
    const runs = [run({ status: "failed" }), run({ status: "failed" })];
    expect(aggregateSummary(runs, startedAt).status).toBe("failed");
  });

  it("computes a non-negative duration from startedAt", () => {
    const summary = aggregateSummary([], startedAt);
    expect(summary.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("handles an empty run list as 'completed' with zero counts", () => {
    const summary = aggregateSummary([], startedAt);
    expect(summary.status).toBe("completed");
    expect(summary.plannedRuns).toBe(0);
    expect(summary.completedRuns).toBe(0);
    expect(summary.skippedRuns).toBe(0);
    expect(summary.failedRuns).toBe(0);
    expect(summary.findingCount).toBe(0);
  });
});

describe("sortRunResults", () => {
  it("sorts by project, then route, then profile, then viewport name", () => {
    const runs = [
      run({ runId: "b", projectName: "b-project" }),
      run({ runId: "a", projectName: "a-project" }),
    ];
    expect(sortRunResults(runs).map((r) => r.runId)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const runs = [run({ runId: "b" }), run({ runId: "a" })];
    const sorted = sortRunResults(runs);
    expect(sorted).not.toBe(runs);
    expect(runs.map((r) => r.runId)).toEqual(["b", "a"]);
  });

  it("treats missing route/viewport as sorting before any named value", () => {
    const withRoute = run({ runId: "with-route", route: "/about" });
    const withoutRoute = run({ runId: "without-route" });
    expect(sortRunResults([withRoute, withoutRoute]).map((r) => r.runId)).toEqual([
      "without-route",
      "with-route",
    ]);
  });
});
