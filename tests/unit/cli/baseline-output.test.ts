import { describe, expect, it } from "vitest";
import { formatAuditHuman } from "../../../packages/cli/src/commands/audit.js";
import {
  formatBaselineComparisonArtifact,
  formatBaselineCreateHuman,
  formatBaselineCreateJson,
  formatBaselineMigrateHuman,
  formatBaselineStatusHuman,
  formatBaselineUpdateHuman,
} from "../../../packages/cli/src/commands/baseline.js";
import {
  formatClassifyHuman,
  type ClassifyResult,
} from "../../../packages/cli/src/commands/classify.js";
import {
  formatFindingsHuman,
  type FindingsResult,
} from "../../../packages/cli/src/commands/findings.js";
import type {
  AuditExecutionResult,
  BaselineComparisonArtifact,
  BaselineEntry,
  BaselineFile,
  BaselineSummary,
  Finding,
  ResolvedFinding,
} from "@a11yst/types";
import type { CompareBaselineResult } from "@a11yst/baseline";

function auditResult(overrides: Partial<AuditExecutionResult> = {}): AuditExecutionResult {
  const finding: Finding = {
    id: "label::baseline-legacy-html::/contact::default::desktop::#email",
    fingerprint: "label|baseline-legacy-html|/contact|default|desktop|#email",
    source: "axe",
    ruleId: "label",
    title: "Form elements must have labels",
    description: "An input is missing an associated label.",
    severity: "critical",
    projectName: "baseline-legacy-html",
    profile: "default",
    viewport: "desktop",
    route: "/contact",
    url: "http://127.0.0.1/contact",
    target: ["#email"],
    standards: [],
    baseline: {
      status: "new",
      baselineFingerprint: "label|baseline-legacy-html|/contact|default|desktop|#email",
      currentSeverity: "critical",
    },
  };

  const baselineSummary: BaselineSummary = {
    baselineUsed: true,
    baselinePath: ".a11yst/baseline.json",
    currentFindings: 4,
    newFindings: 1,
    knownFindings: 3,
    regressedFindings: 0,
    resolvedFindings: 1,
    notComparedFindings: 0,
    expiredClassifications: 0,
    dispositions: {
      falsePositive: 1,
      acceptedRisk: 1,
      thirdParty: 0,
      notApplicable: 0,
      manualReview: 0,
    },
  };

  const resolvedFinding: ResolvedFinding = {
    fingerprint: "button-name|baseline-legacy-html|/contact|default|desktop|#submit",
    fingerprintVersion: "1",
    ruleId: "button-name",
    source: "axe",
    projectName: "baseline-legacy-html",
    location: {
      kind: "route",
      route: "/contact",
      profile: "default",
      viewport: "desktop",
    },
    previousSeverity: "high",
    resolvedAt: "2026-08-03T10:05:00.000Z",
    snapshot: { title: "Submit button label", profile: "default" },
  };

  return {
    schemaVersion: "1",
    status: "completed",
    summary: {
      status: "completed",
      startedAt: "2026-08-03T10:00:00.000Z",
      durationMs: 1200,
      plannedRuns: 1,
      completedRuns: 1,
      skippedRuns: 0,
      failedRuns: 0,
      findingCount: 1,
      findingsBySeverity: { critical: 1, high: 0, medium: 0, minor: 0 },
    },
    plan: {
      projects: [
        {
          name: "baseline-legacy-html",
          platform: "web",
          framework: "html",
        },
      ] as AuditExecutionResult["plan"]["projects"],
      runs: [],
      totalRuns: 1,
      diagnostics: [],
      createdAt: "2026-08-03T10:00:00.000Z",
    },
    runs: [
      {
        runId: "run-1",
        kind: "route",
        projectName: "baseline-legacy-html",
        platform: "web",
        framework: "html",
        profile: "default",
        viewport: { name: "desktop", width: 1440, height: 900 },
        status: "completed",
        startedAt: "2026-08-03T10:00:00.000Z",
        durationMs: 1200,
        findings: [finding],
        diagnostics: [],
        route: "/contact",
        url: "http://127.0.0.1/contact",
      },
    ],
    findings: [finding],
    diagnostics: [],
    limitations: [],
    environment: {
      product: "a11yst",
      productVersion: "1.0.0",
      nodeVersion: "20.0.0",
      browser: "chromium",
      headed: false,
    },
    baselineSummary,
    resolvedFindings: [resolvedFinding],
    ...overrides,
  };
}

const baselineFile: BaselineFile = {
  schemaVersion: "1",
  fingerprintVersion: "1",
  createdAt: "2026-01-15T10:00:00.000Z",
  updatedAt: "2026-01-15T10:00:00.000Z",
  productVersion: "1.0.0",
  entries: [
    {
      fingerprint: "known-fingerprint",
      fingerprintVersion: "1",
      ruleId: "image-alt",
      source: "axe",
      projectName: "site",
      location: {
        kind: "route",
        route: "/",
        profile: "default",
        viewport: "desktop",
      },
      severity: "critical",
      firstSeenAt: "2026-01-15T10:00:00.000Z",
      lastSeenAt: "2026-01-15T10:00:00.000Z",
      snapshot: { title: "Missing alt", profile: "default" },
      classification: {
        disposition: "false-positive",
        reason: "Decorative image",
        createdAt: "2026-01-15T10:00:00.000Z",
        scope: { type: "finding", fingerprint: "known-fingerprint" },
      },
    },
  ],
};

const baselineSummary = auditResult().baselineSummary!;

const comparisonArtifact = {
  schemaVersion: "1",
  fingerprintVersion: "1",
  baselinePath: ".a11yst/baseline.json",
  comparedAt: "2026-08-03T10:00:00.000Z",
  coverage: {
    comparedProjects: ["baseline-legacy-html"],
    skippedProjects: [],
    comparedRoutes: 1,
    comparedFlowCheckpoints: 0,
    notComparedReasons: [],
  },
  summary: baselineSummary,
  new: [],
  known: [],
  regressed: [],
  resolved: [],
  notCompared: [],
  expiredClassifications: [],
  diagnostics: [],
} as unknown as BaselineComparisonArtifact;

const comparisonResult = {
  findings: [],
  resolvedFindings: [],
  notComparedFindings: [],
  summary: baselineSummary,
  artifact: comparisonArtifact,
} as CompareBaselineResult;

const previewAddedEntry = baselineFile.entries[0] as BaselineEntry;

describe("baseline CLI human and JSON formatters", () => {
  it("formatBaselineCreateHuman includes path, entry count, and disclaimer", () => {
    const output = formatBaselineCreateHuman({
      status: "created",
      baselinePath: ".a11yst/baseline.json",
      entryCount: 4,
      createdAt: "2026-08-03T10:00:00.000Z",
    });

    expect(output).toContain("Baseline created");
    expect(output).toContain("Path        .a11yst/baseline.json");
    expect(output).toContain("Entries     4");
    expect(output).toContain("A baseline records known accessibility debt.");
    expect(formatBaselineCreateJson({ status: "created", baselinePath: ".a11yst/baseline.json", entryCount: 4, createdAt: "2026-08-03T10:00:00.000Z" })).toEqual({
      status: "created",
      baselinePath: ".a11yst/baseline.json",
      entryCount: 4,
      createdAt: "2026-08-03T10:00:00.000Z",
    });
  });

  it("formatBaselineStatusHuman reports metadata and comparison summary", () => {
    const withComparison = formatBaselineStatusHuman({
      status: "ok",
      baselinePath: ".a11yst/baseline.json",
      baseline: baselineFile,
      resultsPath: ".a11yst/results/latest.json",
      comparison: comparisonResult,
    });

    expect(withComparison).toContain("Baseline status");
    expect(withComparison).toContain("Compared with latest audit");
    expect(withComparison).toContain("NEW         1");
    expect(withComparison).toContain("False positive1");

    const withoutComparison = formatBaselineStatusHuman({
      status: "ok",
      baselinePath: ".a11yst/baseline.json",
      baseline: baselineFile,
    });
    expect(withoutComparison).toContain("No latest audit results found for comparison.");
  });

  it("formatBaselineUpdateHuman distinguishes preview and updated states", () => {
    const preview = formatBaselineUpdateHuman({
      status: "preview",
      baselinePath: ".a11yst/baseline.json",
      resultsPath: ".a11yst/results/latest.json",
      preview: {
        hasChanges: true,
        added: [previewAddedEntry],
        removed: [],
        unchanged: [],
        regressed: [],
      },
      comparison: comparisonResult,
    });

    expect(preview).toContain("Baseline update preview");
    expect(preview).toContain("No changes were written.");
    expect(preview).toContain("Use --accept-new and/or --remove-resolved with --yes to apply.");
  });

  it("formatBaselineMigrateHuman reports preview messaging", () => {
    const output = formatBaselineMigrateHuman({
      status: "preview",
      baselinePath: ".a11yst/baseline.json",
      migrated: true,
      message: "Would migrate legacy baseline.",
      baseline: baselineFile,
    });

    expect(output).toContain("Baseline migration preview");
    expect(output).toContain("No changes were written.");
  });

  it("formatFindingsHuman renders lifecycle, disposition, and metadata", () => {
    const result: FindingsResult = {
      resultsPath: ".a11yst/results/latest.json",
      baselinePath: ".a11yst/baseline.json",
      baselineUsed: true,
      entries: [
        {
          id: "known-1",
          fingerprint: "known-fingerprint",
          shortFingerprint: "known-finger…",
          ruleId: "image-alt",
          severity: "critical",
          lifecycleStatus: "known",
          disposition: "false-positive",
          projectName: "site",
          location: "/",
          profile: "default",
          viewport: "desktop",
          owner: "platform-team",
          ticket: "A11Y-1",
        },
      ],
    };

    const output = formatFindingsHuman(result);
    expect(output).toContain("Findings");
    expect(output).toContain("KNOWN");
    expect(output).toContain("Disposition false-positive");
    expect(output).toContain("Owner       platform-team");
    expect(output).toContain("Ticket      A11Y-1");
  });

  it("formatFindingsHuman reports when filters match nothing", () => {
    const output = formatFindingsHuman({
      resultsPath: ".a11yst/results/latest.json",
      baselineUsed: false,
      entries: [],
    });
    expect(output).toContain("No findings match the current filters.");
  });

  it("formatClassifyHuman renders preview and classified states", () => {
    const classification: ClassifyResult["classification"] = {
      disposition: "accepted-risk",
      reason: "Tracked remediation",
      owner: "platform-team",
      expiresAt: "2026-12-31",
      createdAt: "2026-08-03T10:00:00.000Z",
      scope: { type: "finding", fingerprint: "known-fingerprint" },
    };

    const preview = formatClassifyHuman({
      status: "preview",
      baselinePath: ".a11yst/baseline.json",
      findingId: "known-1",
      fingerprint: "known-fingerprint",
      disposition: "accepted-risk",
      classification,
    });
    expect(preview).toContain("Classification preview");
    expect(preview).toContain("Accepted risk");
    expect(preview).toContain("Re-run with --yes to apply.");

    const saved = formatClassifyHuman({
      status: "classified",
      baselinePath: ".a11yst/baseline.json",
      findingId: "known-1",
      fingerprint: "known-fingerprint",
      disposition: "accepted-risk",
      classification,
    });
    expect(saved).toContain("Classification saved");
  });

  it("formatAuditHuman includes baseline comparison, resolved findings, and disclaimers", () => {
    const output = formatAuditHuman(auditResult());

    expect(output).toContain("Baseline comparison");
    expect(output).toContain("NEW         1");
    expect(output).toContain("RESOLVED    1");
    expect(output).toContain("Submit button label");
    expect(output).toContain("CRITICAL  NEW");
    expect(output).toContain("label");
    expect(output).toContain("Baseline    .a11yst/baseline.json");
    expect(output).toContain("A baseline records known accessibility debt.");
    // eslint-disable-next-line no-control-regex
    expect(output).not.toMatch(/\x1b\[[0-9;]*m/);
  });

  it("formatBaselineComparisonArtifact returns empty output when baseline was not used", () => {
    expect(formatBaselineComparisonArtifact({ ...auditResult().baselineSummary!, baselineUsed: false })).toEqual([]);
  });
});
