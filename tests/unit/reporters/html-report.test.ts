import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  generateHtmlReport,
  readAuditResult,
  renderHtmlReport,
  renderReportScript,
  renderReportStyles,
  validateAuditResultDocument,
} from "@a11yst/reporters";
import type {
  AuditExecutionResult,
  AuditRunResult,
  Finding,
  NotComparedFinding,
  ResolvedFinding,
  ResolvedWebProject,
} from "@a11yst/types";

const temporaryDirectories: string[] = [];

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "finding-1",
    fingerprint: "fingerprint-1",
    source: "axe",
    ruleId: "image-alt",
    title: "Images must have alternate text",
    description: "An image has no alternate text.",
    severity: "critical",
    routeId: "home",
    routeName: "Home",
    route: "/",
    url: "http://localhost:3000/",
    projectName: "site",
    profile: "default",
    viewport: "desktop",
    target: ["main", "img"],
    html: '<img src="hero.jpg">',
    failureSummary: "Fix the missing alt attribute.",
    helpUrl: "https://example.com/image-alt",
    standards: ["wcag2a", "wcag111"],
    evidence: {
      screenshot: "evidence/site/home/finding.png",
      pageScreenshot: "evidence/site/home/page.png",
    },
    ...overrides,
  };
}

function run(overrides: Partial<AuditRunResult> = {}): AuditRunResult {
  return {
    runId: "run-1",
    projectName: "site",
    platform: "web",
    framework: "html",
    routeId: "home",
    routeName: "Home",
    route: "/",
    url: "http://localhost:3000/",
    profile: "default",
    viewport: { name: "desktop", width: 1280, height: 720 },
    status: "completed",
    startedAt: "2026-08-03T10:00:00.000Z",
    durationMs: 1250,
    findings: [],
    diagnostics: [],
    evidence: {
      screenshot: "evidence/site/home/page.png",
      capturedAt: "2026-08-03T10:00:01.000Z",
      viewport: {
        name: "desktop",
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        orientation: "landscape",
      },
    },
    ...overrides,
  };
}

function webProject(
  overrides: Partial<ResolvedWebProject> = {},
): ResolvedWebProject {
  return {
    name: "site",
    rootDir: ".",
    platform: "web",
    framework: "html",
    adapterId: "html",
    baseUrl: "http://localhost:3000/",
    routes: [
      {
        id: "home",
        name: "Home",
        path: "/",
        origin: "explicit",
      },
      {
        id: "about",
        name: "About",
        path: "/about",
        origin: "filesystem",
        sourceFile: "about.html",
      },
    ],
    routeDiscovery: {
      mode: "fallback",
      include: [],
      exclude: [],
      samples: {},
    },
    readiness: { waitUntil: "domcontentloaded" },
    profiles: ["default"],
    profileOptions: [{ id: "default" }],
    viewports: [
      {
        name: "desktop",
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        orientation: "landscape",
      },
    ],
    flows: [],
    ...overrides,
  };
}

function result(
  overrides: Partial<AuditExecutionResult> = {},
): AuditExecutionResult {
  const findings = [finding()];
  const runs = [
    run({
      findings,
      adapter: {
        adapterId: "html",
        framework: "html",
        supportLevel: "first-class",
        routeOrigin: "explicit",
        readinessStrategy: "load + body",
      },
    }),
  ];
  return {
    schemaVersion: "1",
    auditId: "audit-123",
    status: "completed",
    summary: {
      status: "completed",
      startedAt: "2026-08-03T10:00:00.000Z",
      durationMs: 1250,
      plannedRuns: 1,
      completedRuns: 1,
      skippedRuns: 0,
      failedRuns: 0,
      findingCount: 1,
      findingsBySeverity: {
        critical: 1,
        high: 0,
        medium: 0,
        minor: 0,
      },
    },
    plan: {
      projects: [webProject()],
      runs: [],
      totalRuns: 1,
      diagnostics: [
        {
          code: "HTML_NO_ROUTES_DISCOVERED",
          severity: "info",
          message: "No .html files were discovered under the project root.",
        },
        {
          code: "ROUTE_SAMPLE_MISSING",
          severity: "warning",
          message: 'Dynamic pattern "/users/:id" has no samples configured.',
        },
      ],
      createdAt: "2026-08-03T10:00:00.000Z",
    },
    runs,
    findings,
    diagnostics: [],
    limitations: [],
    environment: {
      product: "a11yst",
      productVersion: "1.0.0",
      nodeVersion: "20.0.0",
      browser: "Chromium",
      headed: false,
    },
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("renderHtmlReport", () => {
  it("escapes untrusted HTML and script-like content", () => {
    const dangerous = '</script><img src=x onerror="alert(1)">';
    const auditResult = result({
      findings: [
        finding({
          title: dangerous,
          html: "<script>alert('xss')</script>",
          description: dangerous,
        }),
      ],
    });

    const html = renderHtmlReport(auditResult);
    expect(html).not.toContain(dangerous);
    expect(html).toContain("&lt;/script&gt;&lt;img");
    expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
  });

  it("renders framework integration, route table, adapter diagnostics, and readiness strategy", () => {
    const html = renderHtmlReport(result());

    expect(html).toContain('id="framework-integration"');
    expect(html).toContain("Framework integration");
    expect(html).toContain("Support level");
    expect(html).toContain("first-class");
    expect(html).toContain("Resolved routes");
    expect(html).toContain("Origin");
    expect(html).toContain("filesystem");
    expect(html).toContain("about.html");
    expect(html).toContain("Skipped dynamic patterns");
    expect(html).toContain("/users/:id");
    expect(html).toContain("Adapter diagnostics");
    expect(html).toContain("HTML_NO_ROUTES_DISCOVERED");
    expect(html).toContain("Readiness strategy");
    expect(html).toContain("load + body");
  });

  it("renders summary counts, runs, disclaimers, and coverage", () => {
    const skipped = run({
      runId: "skipped",
      status: "skipped",
      skipReason: "Native runtime unavailable",
      evidence: undefined,
    });
    const failed = run({
      runId: "failed",
      status: "failed",
      diagnostics: [
        { code: "NAV", severity: "error", message: "Navigation failed" },
      ],
      evidence: undefined,
    });
    const html = renderHtmlReport(
      result({
        summary: {
          ...result().summary,
          plannedRuns: 3,
          skippedRuns: 1,
          failedRuns: 1,
        },
        runs: [run(), skipped, failed],
      }),
    );

    expect(html).toContain("Critical severity");
    expect(html).toContain("Status: skipped");
    expect(html).toContain("Native runtime unavailable");
    expect(html).toContain("Status: failed");
    expect(html).toContain("Navigation failed");
    expect(html).toContain("Profile evidence");
    expect(html).toContain("Profile coverage");
    expect(html).not.toContain(
      "Accessibility profiles approximate test conditions.",
    );
    expect(html).toContain("a11yst does not certify WCAG conformance.");
    expect(html).toContain(
      "Automated checks cover only part of accessibility.",
    );
    expect(html).toContain(
      "Manual review and testing with disabled users remain necessary.",
    );
  });

  it("sorts findings deterministically without changing run order", () => {
    const minor = finding({
      id: "minor",
      title: "Minor first input",
      severity: "minor",
      projectName: "z-project",
    });
    const serious = finding({
      id: "serious",
      title: "Serious second input",
      severity: "high",
      projectName: "b-project",
    });
    const critical = finding({
      id: "critical",
      title: "Critical third input",
      severity: "critical",
      projectName: "a-project",
    });
    const html = renderHtmlReport(
      result({
        findings: [minor, serious, critical],
        runs: [
          run({ runId: "z-run", projectName: "z run" }),
          run({ runId: "a-run", projectName: "a run" }),
        ],
      }),
    );

    expect(html.indexOf("Critical third input")).toBeLessThan(
      html.indexOf("Serious second input"),
    );
    expect(html.indexOf("Serious second input")).toBeLessThan(
      html.indexOf("Minor first input"),
    );
    expect(html.indexOf("z run")).toBeLessThan(html.indexOf("a run"));
  });

  it("keeps every finding in initial HTML and uses relative evidence paths", () => {
    const findings = [
      finding({ id: "one", fingerprint: "one", title: "One" }),
      finding({
        id: "two",
        fingerprint: "two",
        title: "Two",
        evidence: { pageScreenshot: "evidence/space name/page.png" },
      }),
    ];
    const html = renderHtmlReport(result({ findings }));

    expect(html.match(/<article class="finding /g)).toHaveLength(2);
    expect(html).toContain('src="../evidence/site/home/finding.png"');
    expect(html).toContain('src="../evidence/space%20name/page.png"');
    expect(html).not.toContain("<article hidden");
  });

  it("renders semantic landmarks, accessible controls, and local assets", () => {
    const html = renderHtmlReport(result(), { auditId: "custom-audit" });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain(
      "<title>a11yst accessibility report — custom-audit</title>",
    );
    expect(html).toContain('<a class="skip-link" href="#main-content">');
    expect(html).toContain('<main id="main-content">');
    expect(html).toContain("<header");
    expect(html).toContain("<nav");
    expect(html).toContain("<footer");
    for (const name of [
      "severity",
      "project",
      "route",
      "viewport",
      "rule",
      "status",
    ]) {
      expect(html).toContain(`for="filter-${name}"`);
      expect(html).toContain(`id="filter-${name}"`);
    }
    expect(html).toContain('<button type="reset">Clear filters</button>');
    expect(html).toMatch(/<img[^>]+alt="[^"]+"/);
    expect(html).toContain('href="styles.css"');
    expect(html).toContain('src="report.js"');
    expect(html).not.toContain("cdn.");
  });

  it("does not expose provider split, source impact, or engine names in default HTML", () => {
    const html = renderHtmlReport(
      result({
        findings: [
          finding({
            sourceImpact: "serious",
            severity: "high",
          }),
        ],
        profileSummary: {
          completed: ["default"],
          failed: [],
          skipped: [],
          coverage: [
            {
              profile: "default",
              status: "completed",
              automatedChecks: ["Browser accessibility checks completed"],
              heuristicChecks: [],
              manualChecks: ["Screen reader testing"],
              limitations: [],
              a11ystRulesExecuted: [],
              axeExecuted: true,
            },
          ],
          findingsBySource: { axe: 1, a11yst: 0 },
          findingsByAutomation: {
            automated: 1,
            heuristic: 0,
            "manual-review": 0,
          },
          findingsByConfidence: { high: 1, medium: 0, low: 0 },
          manualReviewPending: 0,
        },
      }),
    );

    expect(html).not.toContain("Findings (axe)");
    expect(html).not.toContain("Findings (a11yst)");
    expect(html).not.toContain("axe impact");
    expect(html).not.toContain("axe-core in Chromium");
    expect(html).toContain("Browser accessibility checks completed");
    expect(html).toContain("<dt>Findings</dt>");
    expect(html).not.toContain("<dt>Source</dt>");
  });

  it("renders explicit empty states", () => {
    const empty = result({
      summary: {
        ...result().summary,
        plannedRuns: 0,
        completedRuns: 0,
        findingCount: 0,
        findingsBySeverity: { critical: 0, high: 0, medium: 0, minor: 0 },
      },
      findings: [],
      runs: [],
    });
    const html = renderHtmlReport(empty);
    expect(html).toContain("<h3>No findings</h3>");
    expect(html).toContain("<h3>No runs</h3>");
    expect(html).toContain("0 findings shown");
  });

  it("renders flow checkpoint runs, filters, and flow summary metadata", () => {
    const flowFinding = finding({
      id: "dialog-focus-entry",
      ruleId: "dialog-focus-entry",
      source: "a11yst",
      flowId: "dialog-bad",
      checkpointId: "dialog-open",
      profile: "keyboard",
    });
    const flowRun = run({
      runId: "flow-run",
      kind: "flow-checkpoint",
      flowId: "dialog-bad",
      flowName: "Bad dialog",
      checkpointId: "dialog-open",
      checkpointName: "Bad dialog open",
      profile: "keyboard",
      findings: [flowFinding],
      flowTracePath: "evidence/flows/dialog-bad/trace.json",
    });
    const html = renderHtmlReport(
      result({
        findings: [flowFinding],
        runs: [flowRun],
        flowSummary: {
          configuredFlows: 2,
          completedFlows: 1,
          failedFlows: 0,
          completedCheckpoints: 1,
          skippedCheckpoints: 0,
          failedCheckpoints: 0,
        },
      }),
    );

    expect(html).toContain("Configured flows");
    expect(html).toContain("Completed checkpoints");
    expect(html).toContain("Bad dialog");
    expect(html).toContain("dialog-open");
    expect(html).toContain('for="filter-flow"');
    expect(html).toContain('for="filter-checkpoint"');
    expect(html).toContain('data-flow="dialog-bad"');
    expect(html).toContain('data-checkpoint="dialog-open"');
  });

  it("renders baseline comparison sections, metadata, and filters when baseline was used", () => {
    const classifiedFinding = finding({
      id: "known-1",
      fingerprint: "known-fingerprint",
      severity: "high",
      title: "Known missing label",
      baseline: {
        status: "known",
        baselineFingerprint: "known-fingerprint",
        currentSeverity: "high",
        classification: {
          disposition: "accepted-risk",
          reason: "Planned remediation in Q4",
          owner: "platform-team",
          ticket: "A11Y-42",
          expiresAt: "2026-12-31",
          reviewAt: "2026-09-01",
          createdAt: "2026-08-01T00:00:00.000Z",
          scope: { type: "finding", fingerprint: "known-fingerprint" },
        },
      },
    });
    const regressedFinding = finding({
      id: "regressed-1",
      fingerprint: "regressed-fingerprint",
      severity: "critical",
      title: "Regressed control",
      baseline: {
        status: "regressed",
        baselineFingerprint: "regressed-fingerprint",
        previousSeverity: "medium",
        currentSeverity: "critical",
        regressionReason: "severity-increased",
      },
    });
    const expiredFinding = finding({
      id: "expired-1",
      fingerprint: "expired-fingerprint",
      severity: "medium",
      title: "Expired classification",
      baseline: {
        status: "regressed",
        baselineFingerprint: "expired-fingerprint",
        currentSeverity: "medium",
        classificationExpired: true,
        classification: {
          disposition: "false-positive",
          reason: "Temporary waiver expired",
          expiresAt: "2026-07-01",
          createdAt: "2026-01-01T00:00:00.000Z",
          scope: { type: "finding", fingerprint: "expired-fingerprint" },
        },
      },
    });
    const resolvedFinding: ResolvedFinding = {
      fingerprint: "resolved-fingerprint",
      fingerprintVersion: "1",
      ruleId: "button-name",
      source: "axe",
      projectName: "site",
      location: {
        kind: "route",
        route: "/contact",
        profile: "default",
        viewport: "desktop",
      },
      previousSeverity: "high",
      resolvedAt: "2026-08-03T10:05:00.000Z",
      snapshot: { title: "Contact button label", profile: "default" },
    };
    const notComparedFinding: NotComparedFinding = {
      fingerprint: "missing-fingerprint",
      ruleId: "color-contrast",
      source: "axe",
      projectName: "site",
      location: {
        kind: "route",
        route: "/archive",
        profile: "default",
        viewport: "desktop",
      },
      severity: "medium",
      reason: "coverage-missing",
    };
    const html = renderHtmlReport(
      result({
        findings: [classifiedFinding, regressedFinding, expiredFinding],
        baselineSummary: {
          baselineUsed: true,
          baselinePath: ".a11yst/baseline.json",
          currentFindings: 3,
          newFindings: 0,
          knownFindings: 1,
          regressedFindings: 2,
          resolvedFindings: 1,
          notComparedFindings: 1,
          expiredClassifications: 1,
          dispositions: {
            falsePositive: 1,
            acceptedRisk: 1,
            thirdParty: 0,
            notApplicable: 0,
            manualReview: 0,
          },
        },
        resolvedFindings: [resolvedFinding],
        notComparedFindings: [notComparedFinding],
      }),
    );

    expect(html).toContain('id="baseline-summary"');
    expect(html).toContain("Baseline comparison");
    expect(html).toContain("Schema version");
    expect(html).toContain("Fingerprint version");
    expect(html).toContain("Comparison coverage");
    expect(html).toContain('id="baseline-new"');
    expect(html).toContain("New accessibility findings");
    expect(html).toContain('id="baseline-known"');
    expect(html).toContain("Known accessibility debt");
    expect(html).toContain('id="baseline-regressed"');
    expect(html).toContain("Regressions");
    expect(html).toContain('id="baseline-resolved"');
    expect(html).toContain("Resolved since baseline");
    expect(html).toContain('id="baseline-not-compared"');
    expect(html).toContain("Not compared in this audit");
    expect(html).toContain('id="baseline-classified"');
    expect(html).toContain("Classified findings");
    expect(html).toContain('id="baseline-expired"');
    expect(html).toContain("Expired classifications");
    expect(html).toContain("Previous severity");
    expect(html).toContain("Regression reason");
    expect(html).toContain("Severity increased");
    expect(html).toContain("Accepted risk");
    expect(html).toContain("platform-team");
    expect(html).toContain("A11Y-42");
    expect(html).toContain("Expired state");
    expect(html).toContain('for="filter-lifecycle"');
    expect(html).toContain('for="filter-disposition"');
    expect(html).toContain('for="filter-expired"');
    expect(html).toContain('for="filter-owner"');
    expect(html).toContain('for="filter-ticket"');
    expect(html).toContain('data-lifecycle="known"');
    expect(html).toContain('data-lifecycle="resolved"');
    expect(html).toContain('data-lifecycle="not-compared"');
    expect(html).toContain("Contact button label");
    expect(html).toContain("coverage-missing");
    expect(html).toContain('data-fingerprint="known-fingerprint"');
    expect(html).toContain('data-fingerprint="resolved-fingerprint"');
    expect(html).not.toContain("<article hidden");
    const findingsSection = html.slice(html.indexOf('id="findings"'));
    expect(findingsSection.match(/<article class="finding /g)).toHaveLength(3);
  });
});

describe("report assets", () => {
  it("supports keyboard focus, reflow, and reduced motion", () => {
    const styles = renderReportStyles();
    expect(styles).toContain(":focus-visible");
    expect(styles).toContain(".table-wrap");
    expect(styles).toContain(".visually-hidden");
    expect(styles).toContain("@media (max-width: 40rem)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("uses safe DOM APIs and never innerHTML", () => {
    const script = renderReportScript();
    expect(script).toContain("textContent");
    expect(script).toContain(".hidden");
    expect(script).not.toContain("innerHTML");
  });
});

describe("report generation and validation", () => {
  it("writes index.html and both local assets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "a11yst-report-"));
    temporaryDirectories.push(directory);

    const generated = await generateHtmlReport({
      auditResult: result(),
      outputDirectory: directory,
    });

    expect(generated.indexPath).toBe(join(directory, "report", "index.html"));
    expect(generated.assets).toEqual([
      join(directory, "report", "styles.css"),
      join(directory, "report", "report.js"),
    ]);
    await expect(readFile(generated.indexPath, "utf8")).resolves.toContain(
      "<!doctype html>",
    );
    await expect(readFile(generated.assets[0]!, "utf8")).resolves.toContain(
      ":focus-visible",
    );
    await expect(readFile(generated.assets[1]!, "utf8")).resolves.toContain(
      "textContent",
    );
  });

  it("reads valid JSON and clearly rejects incompatible schemas", async () => {
    const directory = await mkdtemp(join(tmpdir(), "a11yst-result-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "results.json");
    await writeFile(path, JSON.stringify(result()), "utf8");

    await expect(readAuditResult(path)).resolves.toMatchObject({
      schemaVersion: "1",
      auditId: "audit-123",
    });
    expect(() =>
      validateAuditResultDocument({ ...result(), schemaVersion: "2" }),
    ).toThrow('supports only schemaVersion "1"');
    expect(() =>
      validateAuditResultDocument({ ...result(), findings: "invalid" }),
    ).toThrow("findings must be an array");
  });
});
