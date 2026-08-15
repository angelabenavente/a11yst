import { describe, expect, it } from "vitest";
import { compareBaselineWithAudit, emptyBaselineSummary } from "@a11yst/baseline";
import {
  auditResult,
  baselineEntry,
  baselineFile,
  classification,
  finding,
  fixedClock,
  flowFinding,
  flowRun,
  FUTURE_CALENDAR,
  PAST_CALENDAR,
  run,
} from "./fixtures.js";

const BASELINE_PATH = ".a11yst/baseline.json";
const COMPARED_AT = "2026-08-04T12:00:00.000Z";

function compare(
  baseline = baselineFile(),
  result = auditResult(),
  options: Parameters<typeof compareBaselineWithAudit>[2] = {},
) {
  return compareBaselineWithAudit(baseline, result, {
    baselinePath: BASELINE_PATH,
    clock: fixedClock(COMPARED_AT),
    comparedAt: COMPARED_AT,
    ...options,
  });
}

describe("compareBaselineWithAudit", () => {
  it("classifies findings not in baseline as new", () => {
    const fp = "new|website|/|default|desktop|#new";
    const comparison = compare(
      baselineFile({ entries: [] }),
      auditResult({
        runs: [run({ route: "/" })],
        findings: [finding({ fingerprint: fp, ruleId: "new" })],
      }),
    );

    expect(comparison.summary.newFindings).toBe(1);
    expect(comparison.findings[0]?.baseline?.status).toBe("new");
    expect(comparison.artifact.new[0]?.fingerprint).toBe(fp);
  });

  it("classifies unchanged baseline matches as known", () => {
    const entry = baselineEntry();
    const comparison = compare(
      baselineFile({ entries: [entry] }),
      auditResult({
        runs: [run({ route: "/" })],
        findings: [finding()],
      }),
    );

    expect(comparison.summary.knownFindings).toBe(1);
    expect(comparison.findings[0]?.baseline?.status).toBe("known");
    expect(comparison.artifact.known).toHaveLength(1);
  });

  it("classifies baseline entries absent from audit as resolved when covered", () => {
    const entry = baselineEntry({ fingerprint: "resolved-fp" });
    const comparison = compare(
      baselineFile({ entries: [entry] }),
      auditResult({
        runs: [run({ route: "/" })],
        findings: [],
      }),
    );

    expect(comparison.summary.resolvedFindings).toBe(1);
    expect(comparison.resolvedFindings[0]?.fingerprint).toBe("resolved-fp");
    expect(comparison.resolvedFindings[0]?.resolvedAt).toBe(COMPARED_AT);
  });

  it("marks baseline entries as not compared when coverage is missing", () => {
    const entry = baselineEntry({
      fingerprint: "uncovered-fp",
      location: { kind: "route", route: "/not-run", profile: "default", viewport: "desktop" },
    });
    const comparison = compare(
      baselineFile({ entries: [entry] }),
      auditResult({
        runs: [run({ route: "/" })],
        findings: [],
      }),
    );

    expect(comparison.summary.notComparedFindings).toBe(1);
    expect(comparison.notComparedFindings[0]?.reason).toBe("coverage-missing");
    expect(comparison.summary.resolvedFindings).toBe(0);
  });

  it("detects severity-increased regressions", () => {
    const entry = baselineEntry({ severity: "medium" });
    const comparison = compare(
      baselineFile({ entries: [entry] }),
      auditResult({
        runs: [run({ route: "/" })],
        findings: [finding({ severity: "critical" })],
      }),
    );

    expect(comparison.summary.regressedFindings).toBe(1);
    expect(comparison.findings[0]?.baseline?.status).toBe("regressed");
    expect(comparison.findings[0]?.baseline?.regressionReason).toBe("severity-increased");
    expect(comparison.artifact.regressed[0]?.regressionReason).toBe("severity-increased");
  });

  it("detects classification-expired regressions with injectable clock", () => {
    const entry = baselineEntry({
      classification: classification({
        disposition: "accepted-risk",
        owner: "team",
        expiresAt: PAST_CALENDAR,
      }),
    });
    const comparison = compare(
      baselineFile({ entries: [entry] }),
      auditResult({
        runs: [run({ route: "/" })],
        findings: [finding()],
      }),
      { clock: fixedClock("2020-01-02T00:00:00.000Z") },
    );

    expect(comparison.summary.regressedFindings).toBe(1);
    expect(comparison.findings[0]?.baseline?.regressionReason).toBe("classification-expired");
    expect(comparison.summary.expiredClassifications).toBe(1);
    expect(comparison.artifact.expiredClassifications[0]?.disposition).toBe("accepted-risk");
  });

  it("does not regress when classification is still valid", () => {
    const entry = baselineEntry({
      classification: classification({
        disposition: "accepted-risk",
        owner: "team",
        expiresAt: FUTURE_CALENDAR,
      }),
    });
    const comparison = compare(
      baselineFile({ entries: [entry] }),
      auditResult({
        runs: [run({ route: "/" })],
        findings: [finding()],
      }),
    );

    expect(comparison.summary.knownFindings).toBe(1);
    expect(comparison.summary.regressedFindings).toBe(0);
    expect(comparison.summary.expiredClassifications).toBe(0);
  });

  it("detects returned-after-resolution regressions", () => {
    const entry = baselineEntry({
      lifecycle: { lastStatus: "resolved", resolvedAt: "2026-01-01T00:00:00.000Z" },
    });
    const comparison = compare(
      baselineFile({ entries: [entry] }),
      auditResult({
        runs: [run({ route: "/" })],
        findings: [finding()],
      }),
    );

    expect(comparison.findings[0]?.baseline?.regressionReason).toBe("returned-after-resolution");
  });

  it("detects confidence-increased regressions for a11yst findings", () => {
    const fp = "dialog-focus::website::checkout::step-open::default::desktop::#open";
    const entry = baselineEntry({
      fingerprint: fp,
      source: "a11yst",
      location: {
        kind: "flow-checkpoint",
        flowId: "checkout",
        checkpointId: "step-open",
        profile: "default",
        viewport: "desktop",
      },
      snapshot: { title: "Focus issue", profile: "default", confidence: "low" },
    });
    const comparison = compare(
      baselineFile({ entries: [entry] }),
      auditResult({
        runs: [flowRun({ flowId: "checkout", checkpointId: "step-open" })],
        findings: [flowFinding({ fingerprint: fp, confidence: "high" })],
      }),
    );

    expect(comparison.findings[0]?.baseline?.regressionReason).toBe("confidence-increased");
  });

  it("compares flow findings separately from route findings", () => {
    const routeEntry = baselineEntry();
    const flowEntry = baselineEntry({
      fingerprint: "flow-fp",
      location: {
        kind: "flow-checkpoint",
        flowId: "checkout",
        checkpointId: "open",
        profile: "default",
      },
    });
    const comparison = compare(
      baselineFile({ entries: [routeEntry, flowEntry] }),
      auditResult({
        runs: [
          run({ route: "/" }),
          flowRun({ flowId: "checkout", checkpointId: "open" }),
        ],
        findings: [
          finding(),
          flowFinding({ fingerprint: "flow-fp", flowId: "checkout", checkpointId: "open" }),
        ],
      }),
    );

    expect(comparison.summary.knownFindings).toBe(2);
    expect(comparison.artifact.coverage.comparedRoutes).toEqual(["/"]);
    expect(comparison.artifact.coverage.comparedFlows).toEqual([
      { flowId: "checkout", checkpointIds: ["open"] },
    ]);
  });

  it("omits classifications when applyClassifications is false", () => {
    const entry = baselineEntry({
      classification: classification({ disposition: "false-positive" }),
    });
    const comparison = compare(
      baselineFile({ entries: [entry] }),
      auditResult({
        runs: [run({ route: "/" })],
        findings: [finding()],
      }),
      { applyClassifications: false },
    );

    expect(comparison.findings[0]?.baseline?.classification).toBeUndefined();
  });

  it("counts disposition totals from baseline entries", () => {
    const comparison = compare(
      baselineFile({
        entries: [
          baselineEntry({
            fingerprint: "fp1",
            classification: classification({ disposition: "false-positive" }),
          }),
          baselineEntry({
            fingerprint: "fp2",
            location: { kind: "route", route: "/about", profile: "default" },
            classification: classification({
              disposition: "accepted-risk",
              owner: "team",
              expiresAt: FUTURE_CALENDAR,
            }),
          }),
        ],
      }),
      auditResult({ runs: [run({ route: "/" }), run({ route: "/about" })], findings: [] }),
    );

    expect(comparison.summary.dispositions.falsePositive).toBe(1);
    expect(comparison.summary.dispositions.acceptedRisk).toBe(1);
  });
});

describe("emptyBaselineSummary", () => {
  it("returns zeroed summary with baselineUsed false", () => {
    expect(emptyBaselineSummary()).toEqual({
      baselineUsed: false,
      currentFindings: 0,
      newFindings: 0,
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
    });
  });
});
