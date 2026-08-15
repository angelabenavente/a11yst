import { describe, expect, it } from "vitest";
import { formatAuditHuman } from "@a11yst/cli";
import type { AuditExecutionResult } from "@a11yst/types";

function minimalResult(artifacts?: AuditExecutionResult["artifacts"]): AuditExecutionResult {
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
      findingCount: 0,
      findingsBySeverity: { critical: 0, high: 0, medium: 0, minor: 0 },
    },
    plan: { projects: [], runs: [], totalRuns: 1, diagnostics: [], createdAt: "2026-08-03T10:00:00.000Z" },
    runs: [],
    findings: [],
    diagnostics: [],
    limitations: [],
    environment: {
      product: "a11yst",
      productVersion: "0.1.0",
      nodeVersion: "20.0.0",
      browser: "chromium",
      headed: false,
    },
    artifacts,
  };
}

describe("formatAuditHuman SARIF output", () => {
  it("prints bundle SARIF path by default", () => {
    const output = formatAuditHuman(
      minimalResult({
        outputDirectory: "/tmp/bundle",
        manifestPath: "/tmp/bundle/manifest.json",
        resultsPath: "/tmp/bundle/results.json",
        latestPath: "/tmp/latest.json",
        sarifPath: "reports/a11yst.sarif",
      }),
    );
    expect(output).toContain("SARIF report: reports/a11yst.sarif");
    expect(output).not.toContain("Bundle copy:");
  });

  it("prints custom and bundle paths when both exist", () => {
    const output = formatAuditHuman(
      minimalResult({
        outputDirectory: "/tmp/bundle",
        manifestPath: "/tmp/bundle/manifest.json",
        resultsPath: "/tmp/bundle/results.json",
        latestPath: "/tmp/latest.json",
        sarifPath: "reports/a11yst.sarif",
      }),
      { sarifExternalPath: "./artifacts/a11yst.sarif" },
    );
    expect(output).toContain("SARIF report: ./artifacts/a11yst.sarif");
    expect(output).toContain("Bundle copy: reports/a11yst.sarif");
  });
});
