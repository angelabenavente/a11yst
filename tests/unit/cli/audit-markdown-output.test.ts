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
      productVersion: "1.0.0",
      nodeVersion: "20.0.0",
      browser: "chromium",
      headed: false,
    },
    artifacts,
  };
}

describe("formatAuditHuman Markdown output", () => {
  it("prints bundle Markdown path by default", () => {
    const output = formatAuditHuman(
      minimalResult({
        outputDirectory: "/tmp/bundle",
        manifestPath: "/tmp/bundle/manifest.json",
        resultsPath: "/tmp/bundle/results.json",
        latestPath: "/tmp/latest.json",
        markdownPath: "reports/a11yst.md",
      }),
    );
    expect(output).toContain("Markdown report: reports/a11yst.md");
    expect(output).not.toContain("Bundle copy:");
  });

  it("prints custom and bundle paths when both exist", () => {
    const output = formatAuditHuman(
      minimalResult({
        outputDirectory: "/tmp/bundle",
        manifestPath: "/tmp/bundle/manifest.json",
        resultsPath: "/tmp/bundle/results.json",
        latestPath: "/tmp/latest.json",
        markdownPath: "reports/a11yst.md",
      }),
      { markdownExternalPath: "./artifacts/a11yst.md" },
    );
    expect(output).toContain("Markdown report: ./artifacts/a11yst.md");
    expect(output).toContain("Bundle copy: reports/a11yst.md");
  });
});

describe("formatAuditHuman GitHub annotations output", () => {
  it("prints bundle GitHub annotations path by default", () => {
    const output = formatAuditHuman(
      minimalResult({
        outputDirectory: "/tmp/bundle",
        manifestPath: "/tmp/bundle/manifest.json",
        resultsPath: "/tmp/bundle/results.json",
        latestPath: "/tmp/latest.json",
        githubAnnotationsPath: "reports/github-annotations.txt",
      }),
    );
    expect(output).toContain("GitHub annotations: reports/github-annotations.txt");
    expect(output).not.toContain("Bundle copy:");
  });

  it("prints custom and bundle paths when both exist", () => {
    const output = formatAuditHuman(
      minimalResult({
        outputDirectory: "/tmp/bundle",
        manifestPath: "/tmp/bundle/manifest.json",
        resultsPath: "/tmp/bundle/results.json",
        latestPath: "/tmp/latest.json",
        githubAnnotationsPath: "reports/github-annotations.txt",
      }),
      { githubAnnotationsExternalPath: "./artifacts/github-annotations.txt" },
    );
    expect(output).toContain("GitHub annotations: ./artifacts/github-annotations.txt");
    expect(output).toContain("Bundle copy: reports/github-annotations.txt");
  });
});

describe("formatAuditHuman GitHub step summary output", () => {
  it("prints step summary confirmation when written", () => {
    const output = formatAuditHuman(
      minimalResult({
        outputDirectory: "/tmp/bundle",
        manifestPath: "/tmp/bundle/manifest.json",
        resultsPath: "/tmp/bundle/results.json",
        latestPath: "/tmp/latest.json",
        markdownPath: "reports/a11yst.md",
      }),
      { githubStepSummaryWritten: true },
    );
    expect(output).toContain("GitHub step summary: written");
  });
});
