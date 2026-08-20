import { describe, expect, it } from "vitest";
import { applyPolicyEvaluation, applySourceAnalysis } from "@a11yst/core";
import type { AuditExecutionResult, ResolvedConfig } from "@a11yst/types";

function syntheticResult(): AuditExecutionResult {
  return {
    schemaVersion: "1",
    status: "completed",
    summary: {
      status: "completed",
      startedAt: "2026-08-03T10:00:00.000Z",
      durationMs: 1,
      plannedRuns: 1,
      completedRuns: 1,
      failedRuns: 0,
      skippedRuns: 0,
      findingCount: 1,
      findingsBySeverity: { critical: 0, high: 1, medium: 0, minor: 0 },
    },
    plan: {
      projects: [],
      runs: [],
      totalRuns: 1,
      diagnostics: [],
      createdAt: "2026-08-03T10:00:00.000Z",
    },
    runs: [],
    findings: [
      {
        id: "finding-1",
        fingerprint: "button-name|site|/|default|desktop|button#save",
        source: "axe",
        ruleId: "button-name",
        title: "Buttons must have discernible text",
        severity: "high",
        route: "/",
        projectName: "site",
        profile: "default",
        viewport: "desktop",
        target: ["button#save"],
        standards: ["wcag2a"],
      },
    ],
    diagnostics: [],
    limitations: [],
    environment: {
      product: "a11yst",
      productVersion: "1.0.0",
      nodeVersion: "20.20.2",
      headed: false,
    },
  };
}

function syntheticConfig(): ResolvedConfig {
  return {
    outputDir: ".a11yst/results",
    evidence: { screenshots: true, fullPage: false },
    reports: {
      html: true,
      sarif: false,
      junit: false,
      markdown: false,
      githubAnnotations: false,
      githubStepSummary: false,
    },
    baseline: { file: ".a11yst/baseline.json", compare: false, classifications: true },
    ci: {
      failOnNew: false,
      failOnRegression: false,
      failOnExpiredClassification: false,
      minimumSeverity: "high",
    },
    sourceAnalysis: { enabled: false, ranking: false, recommendations: false },
    projects: [
      {
        name: "site",
        rootDir: ".",
        platform: "web",
        framework: "html",
        adapterId: "html",
        baseUrl: "http://localhost:3000/",
        routes: [],
        routeDiscovery: { mode: "fallback", include: [], exclude: [], samples: {} },
        readiness: { waitUntil: "domcontentloaded" },
        profiles: ["default"],
        profileOptions: [],
        viewports: [],
        flows: [],
      },
    ],
    configDir: process.cwd(),
    configPath: "",
    diagnostics: [],
  };
}

describe("core source analysis integration", () => {
  it("keeps policy evaluation unchanged when source analysis is disabled", async () => {
    const config = syntheticConfig();
    const result = syntheticResult();
    const enriched = await applySourceAnalysis(config, result);
    const baselineApplied = {
      result,
      baselineApplied: false,
      comparison: undefined,
    };
    const policyOff = applyPolicyEvaluation(result, config.ci, baselineApplied);
    const policyOn = applyPolicyEvaluation(enriched, config.ci, baselineApplied);
    expect(policyOn).toEqual(policyOff);
  });
});
