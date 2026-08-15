import { describe, expect, it } from "vitest";
import { generateMarkdownReport } from "@a11yst/reporters";
import {
  baseInput,
  completeComparisonInput,
  expiredPolicyBreach,
  hostileFindingMetadata,
  knownFinding,
  newFinding,
  newPolicyBreach,
  notComparedFinding,
  policyEvaluation,
  policyNotEvaluated,
  regressedFinding,
  regressionPolicyBreach,
  resolvedFindingEntry,
  SECRET_PASSWORD,
  SECRET_TOKEN,
} from "./fixtures.js";

function render(input: Parameters<typeof generateMarkdownReport>[0], options?: Parameters<typeof generateMarkdownReport>[1]): string {
  return generateMarkdownReport(input, options).markdown;
}

describe("generateMarkdownReport structure", () => {
  it("generates a minimal valid Markdown document", () => {
    const result = generateMarkdownReport(baseInput());
    expect(result.markdown).toMatch(/^# a11yst Accessibility Report\n/);
    expect(result.markdown).toContain("## Status");
    expect(result.markdown).toContain("## Accessibility lifecycle");
    expect(result.markdown).toContain("Automated testing does not establish WCAG conformance.");
    expect(result.markdown.endsWith("\n")).toBe(true);
    expect(result.summary.findings).toBe(0);
    // eslint-disable-next-line no-control-regex
    expect(result.markdown).not.toMatch(/\x1b\[[0-9;]*m/);
  });

  it("uses a custom title", () => {
    const markdown = render(baseInput(), { title: "CI accessibility report" });
    expect(markdown).toContain("# CI accessibility report");
  });
});

describe("policy metadata", () => {
  it("marks policy as not available when evaluation is absent", () => {
    const result = generateMarkdownReport(baseInput());
    expect(result.markdown).toContain("| CI policy | Not available |");
    expect(result.diagnostics.some((entry) => entry.code === "missing-policy-data")).toBe(true);
  });

  it("records passed policy without breach section", () => {
    const markdown = render(
      baseInput({
        policyEvaluation: policyEvaluation({ status: "passed", policyEnabled: true }),
      }),
    );
    expect(markdown).toContain("| CI policy | Passed |");
    expect(markdown).not.toContain("## CI policy breaches");
    expect(markdown).toContain("did not report any blocking breaches");
  });

  it("creates breach rows for new, regression, and expired breaches", () => {
    const markdown = render(
      baseInput({
        policyEvaluation: policyEvaluation({
          status: "failed",
          breaches: [newPolicyBreach(), regressionPolicyBreach(), expiredPolicyBreach()],
        }),
      }),
    );
    expect(markdown).toContain("## CI policy breaches");
    expect(markdown).toContain("| HIGH | New | button-name |");
    expect(markdown).toContain("| CRITICAL | Regression | color-contrast |");
    expect(markdown).toContain("| MEDIUM | Expired classification | label |");
    expect(markdown).toContain("Expected exit code: 2");
  });

  it("records policy not-evaluated with diagnostic message", () => {
    const markdown = render(
      baseInput({
        policyEvaluation: policyNotEvaluated(),
      }),
    );
    expect(markdown).toContain("| CI policy | Not evaluated |");
    expect(markdown).toContain("Baseline comparison was unavailable for policy evaluation.");
  });

  it("includes minimum severity when provided", () => {
    const markdown = render(
      baseInput({
        policyEvaluation: policyEvaluation({ status: "passed", policyEnabled: true }),
        policyMinimumSeverity: "high",
      }),
    );
    expect(markdown).toContain("| Minimum severity | HIGH |");
  });
});

describe("lifecycle and detailed findings", () => {
  it("reports lifecycle counts from baseline summary", () => {
    const result = generateMarkdownReport(
      completeComparisonInput({
        findings: [knownFinding(), notComparedFinding()],
        baselineSummary: {
          baselineUsed: true,
          baselinePath: ".a11yst/baseline.json",
          currentFindings: 2,
          newFindings: 0,
          knownFindings: 1,
          regressedFindings: 0,
          resolvedFindings: 1,
          notComparedFindings: 1,
          expiredClassifications: 0,
          dispositions: {
            falsePositive: 1,
            acceptedRisk: 0,
            thirdParty: 0,
            notApplicable: 0,
            manualReview: 0,
          },
        },
        resolvedFindings: [resolvedFindingEntry()],
      }),
    );
    expect(result.markdown).toContain("| Known | 1 |");
    expect(result.markdown).toContain("| Resolved | 1 |");
    expect(result.markdown).toContain("| Not compared | 1 |");
    expect(result.markdown).toContain("## Resolved findings");
    expect(result.markdown).toContain("## Classified findings");
  });

  it("includes grouped findings for new and regressed items", () => {
    const result = generateMarkdownReport(
      completeComparisonInput({
        findings: [newFinding(), regressedFinding()],
        policyEvaluation: policyEvaluation({
          status: "failed",
          breaches: [newPolicyBreach(), regressionPolicyBreach()],
        }),
      }),
    );
    expect(result.markdown).toContain("## Findings");
    expect(result.markdown).toContain("### HIGH · button-name ·");
    expect(result.markdown).toContain("### CRITICAL · color-contrast ·");
    expect(result.summary.detailedFindings).toBe(2);
  });

  it("truncates grouped affected elements and records diagnostics", () => {
    const findings = Array.from({ length: 5 }, (_, index) =>
      newFinding({
        fingerprint: `fp-${index}`,
        ruleId: `rule-${index}`,
      }),
    );
    const result = generateMarkdownReport(
      baseInput({ findings }),
      { maxDetailedFindings: 2 },
    );
    expect(result.summary.detailedFindings).toBe(2);
    expect(result.summary.truncatedFindings).toBe(3);
    expect(result.diagnostics.some((entry) => entry.code === "truncated-findings")).toBe(true);
    expect(result.markdown).toContain("3 additional affected elements are not shown.");
  });

  it("groups repeated rule findings once", () => {
    const findings = [
      newFinding({ fingerprint: "fp-1", target: ["#a"] }),
      newFinding({ fingerprint: "fp-2", target: ["#b"] }),
    ];
    const result = generateMarkdownReport(baseInput({ findings }));
    expect(result.markdown.match(/### HIGH · button-name · 2 affected elements/g)?.length).toBe(1);
  });
});

describe("audit metadata and execution failures", () => {
  it("renders audit metadata and severity summary", () => {
    const markdown = render(
      baseInput({
        metadata: {
          project: "demo",
          auditId: "audit-123",
          target: "http://127.0.0.1:5173",
          framework: "react",
          startedAt: "2026-08-11T12:00:00.000Z",
          routes: ["/", "/settings"],
          profiles: ["default"],
          viewports: ["desktop"],
          uniqueIssueGroups: 2,
          totalAffectedElements: 6,
          findingsBySeverity: { critical: 1, high: 5, medium: 0, minor: 0 },
        },
        findings: [newFinding()],
      }),
    );
    expect(markdown).toContain("## Audit metadata");
    expect(markdown).toContain("| Project | demo |");
    expect(markdown).toContain("## Summary");
    expect(markdown).toContain("| CRITICAL | 1 |");
    expect(markdown).toContain("Unique issue groups: 2");
    expect(markdown).toContain("Total affected elements: 6");
  });

  it("reports execution failure without implying zero-barrier success", () => {
    const markdown = render(
      baseInput({
        audit: { successful: false },
        metadata: {
          executionFailed: true,
          failureMessages: ["Unknown project: missing"],
          totalAffectedElements: 0,
          uniqueIssueGroups: 0,
          findingsBySeverity: { critical: 0, high: 0, medium: 0, minor: 0 },
        },
        findings: [],
      }),
    );
    expect(markdown).toContain("## Execution");
    expect(markdown).toContain("Audit execution failed.");
    expect(markdown).toContain("Unknown project: missing");
    expect(markdown).not.toContain("## Findings");
  });
});

describe("comparison coverage", () => {
  it("marks comparison incomplete when not-compared findings exist", () => {
    const markdown = render(
      completeComparisonInput({
        findings: [notComparedFinding()],
        baselineSummary: {
          baselineUsed: true,
          baselinePath: ".a11yst/baseline.json",
          currentFindings: 1,
          newFindings: 0,
          knownFindings: 0,
          regressedFindings: 0,
          resolvedFindings: 0,
          notComparedFindings: 1,
          expiredClassifications: 0,
          dispositions: {
            falsePositive: 0,
            acceptedRisk: 0,
            thirdParty: 0,
            notApplicable: 0,
            manualReview: 0,
          },
        },
      }),
    );
    expect(markdown).toContain("## Comparison coverage");
    expect(markdown).toContain("Comparison coverage is incomplete.");
  });
});

describe("artifact links", () => {
  it("renders safe relative artifact links", () => {
    const markdown = render(
      baseInput({
        reports: {
          html: { path: "report/index.html" },
          sarif: { path: "reports/a11yst.sarif" },
          junit: { path: "reports/a11yst.junit.xml" },
          markdown: { path: "reports/a11yst.md" },
        },
      }),
    );
    expect(markdown).toContain("## Reports");
    expect(markdown).toContain("[report/index.html](report/index.html)");
    expect(markdown).toContain("[SARIF report](reports/a11yst.sarif)");
    expect(markdown).toContain("[JUnit report](reports/a11yst.junit.xml)");
    expect(markdown).toContain("JSON results: `results.json`");
  });

  it("omits unsafe artifact links and records diagnostics", () => {
    const result = generateMarkdownReport(
      baseInput({
        reports: {
          html: { path: "/etc/passwd" },
          sarif: { path: "../escape.sarif" },
        },
      }),
    );
    expect(result.markdown).not.toContain("/etc/passwd");
    expect(result.markdown).not.toContain("../escape.sarif");
    expect(result.diagnostics.filter((entry) => entry.code === "invalid-link")).toHaveLength(2);
  });

  it("encodes spaces in link targets", () => {
    const markdown = render(
      baseInput({
        reports: {
          html: { path: "my reports/index.html" },
        },
      }),
    );
    expect(markdown).toContain("[report/index.html](my%20reports/index.html)");
  });
});

describe("determinism", () => {
  it("produces identical Markdown for shuffled breaches and findings", () => {
    const breaches = [expiredPolicyBreach(), newPolicyBreach(), regressionPolicyBreach()];
    const findings = [regressedFinding(), newFinding(), knownFinding()];
    const forward = render(
      baseInput({
        findings,
        policyEvaluation: policyEvaluation({ status: "failed", breaches }),
      }),
    );
    const reversed = render(
      baseInput({
        findings: [...findings].reverse(),
        policyEvaluation: policyEvaluation({
          status: "failed",
          breaches: [...breaches].reverse(),
        }),
      }),
    );
    expect(forward).toBe(reversed);
  });
});

describe("security and escaping", () => {
  it("does not copy secrets from hostile finding metadata into Markdown", () => {
    const markdown = render(hostileFindingMetadata());
    expect(markdown).not.toContain(SECRET_TOKEN);
    expect(markdown).not.toContain(SECRET_PASSWORD);
  });

  it("escapes markdown injection in policy diagnostic messages", () => {
    const markdown = render(
      baseInput({
        policyEvaluation: policyNotEvaluated({
          diagnostics: [
            {
              code: "baseline-not-used",
              level: "error",
              message: '# injected heading\n<script>alert("x")</script>',
            },
          ],
        }),
      }),
    );
    expect(markdown).not.toMatch(/^# injected heading/m);
    expect(markdown).toContain("\\# injected heading");
    expect(markdown).toContain("&lt;script&gt;");
  });

  it("escapes table-breaking characters in rendered fields", () => {
    const markdown = render(
      baseInput({
        policyEvaluation: policyEvaluation({
          status: "failed",
          breaches: [
            newPolicyBreach({
              ruleId: 'rule|with"pipe',
              projectName: "store|front",
            }),
          ],
        }),
        findings: [
          newFinding({
            ruleId: 'rule|with"pipe',
            projectName: "store|front",
            route: "/quotes\" & <tags>",
          }),
        ],
      }),
    );
    expect(markdown).toContain("rule\\|with\"pipe");
    expect(markdown).toContain("store\\|front");
    expect(markdown).not.toMatch(/\| HIGH \| New \| rule\|/);
  });
});

describe("provider-neutral human reporting", () => {
  it("uses unified findings headings and automation-based coverage without provider names", () => {
    const markdown = render(
      baseInput({
        findings: [newFinding({ sourceImpact: "serious", severity: "high" })],
        metadata: {
          project: "demo",
          target: "http://127.0.0.1:5173",
          findingsBySeverity: { critical: 0, high: 1, medium: 0, minor: 0 },
          uniqueIssueGroups: 1,
          totalAffectedElements: 1,
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
                manualChecks: ["Color contrast review"],
                limitations: [],
                a11ystRulesExecuted: [],
                axeExecuted: true,
              },
            ],
            findingsBySource: { axe: 1, a11yst: 0 },
            findingsByAutomation: { automated: 1, heuristic: 0, "manual-review": 0 },
            findingsByConfidence: { high: 1, medium: 0, low: 0 },
            manualReviewPending: 0,
          },
        },
      }),
    );

    expect(markdown).toContain("## Findings");
    expect(markdown).not.toContain("Findings (axe)");
    expect(markdown).not.toContain("Findings (a11yst)");
    expect(markdown).not.toContain("axe impact");
    expect(markdown).not.toContain("axe-core in Chromium");
    expect(markdown).toContain("Browser accessibility checks completed");
  });
});
