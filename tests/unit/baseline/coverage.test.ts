import { describe, expect, it } from "vitest";
import {
  buildComparisonCoverage,
  entryInComparisonCoverage,
  locationInComparisonCoverage,
  runCoversBaselineEntry,
} from "@a11yst/baseline";
import { auditResult, baselineEntry, flowRun, run } from "./fixtures.js";

describe("buildComparisonCoverage", () => {
  it("collects completed route runs", () => {
    const coverage = buildComparisonCoverage(
      auditResult({
        runs: [
          run({ runId: "r1", route: "/" }),
          run({ runId: "r2", route: "/about" }),
        ],
      }),
    );

    expect(coverage.comparedProjects).toEqual(["website"]);
    expect(coverage.comparedProfiles).toEqual(["default"]);
    expect(coverage.comparedViewports).toEqual(["desktop"]);
    expect(coverage.comparedRoutes).toEqual(["/", "/about"]);
    expect(coverage.comparedFlows).toEqual([]);
    expect(coverage.failedRuns).toEqual([]);
    expect(coverage.skippedRuns).toEqual([]);
  });

  it("collects completed flow checkpoint runs", () => {
    const coverage = buildComparisonCoverage(
      auditResult({
        runs: [
          flowRun({ runId: "f1", flowId: "checkout", checkpointId: "open" }),
          flowRun({ runId: "f2", flowId: "checkout", checkpointId: "confirm" }),
        ],
      }),
    );

    expect(coverage.comparedRoutes).toEqual([]);
    expect(coverage.comparedFlows).toEqual([
      { flowId: "checkout", checkpointIds: ["confirm", "open"] },
    ]);
  });

  it("excludes failed and skipped runs from coverage", () => {
    const coverage = buildComparisonCoverage(
      auditResult({
        runs: [
          run({ runId: "ok", route: "/", status: "completed" }),
          run({ runId: "fail", route: "/broken", status: "failed" }),
          run({ runId: "skip", route: "/later", status: "skipped" }),
        ],
      }),
    );

    expect(coverage.comparedRoutes).toEqual(["/"]);
    expect(coverage.failedRuns).toEqual(["fail"]);
    expect(coverage.skippedRuns).toEqual(["skip"]);
  });

  it("marks planned projects missing from completed runs as excluded", () => {
    const coverage = buildComparisonCoverage(
      auditResult({
        plan: {
          ...auditResult().plan,
          projects: [
            auditResult().plan.projects[0]!,
            {
              ...auditResult().plan.projects[0]!,
              name: "mobile-app",
            },
          ],
        },
        runs: [run({ projectName: "website", route: "/" })],
      }),
    );

    expect(coverage.comparedProjects).toEqual(["website"]);
    expect(coverage.excludedProjects).toEqual(["mobile-app"]);
  });

  it("supports routes-only audits without flow coverage", () => {
    const coverage = buildComparisonCoverage(
      auditResult({
        runs: [run({ route: "/contact" })],
      }),
    );

    expect(coverage.comparedRoutes).toEqual(["/contact"]);
    expect(coverage.comparedFlows).toEqual([]);
  });

  it("supports flows-only audits without route coverage", () => {
    const coverage = buildComparisonCoverage(
      auditResult({
        runs: [flowRun({ flowId: "signup", checkpointId: "welcome" })],
      }),
    );

    expect(coverage.comparedRoutes).toEqual([]);
    expect(coverage.comparedFlows).toEqual([
      { flowId: "signup", checkpointIds: ["welcome"] },
    ]);
  });
});

describe("entryInComparisonCoverage", () => {
  const routeCoverage = buildComparisonCoverage(
    auditResult({ runs: [run({ route: "/" })] }),
  );

  it("returns true when route entry is within coverage", () => {
    const entry = baselineEntry();
    expect(entryInComparisonCoverage(entry, routeCoverage)).toBe(true);
  });

  it("returns false when route was not audited", () => {
    const entry = baselineEntry({
      location: { kind: "route", route: "/missing", profile: "default", viewport: "desktop" },
    });
    expect(entryInComparisonCoverage(entry, routeCoverage)).toBe(false);
  });

  it("returns false when project or profile is missing from coverage", () => {
    const entry = baselineEntry({ projectName: "other-project" });
    expect(entryInComparisonCoverage(entry, routeCoverage)).toBe(false);

    const wrongProfile = baselineEntry({
      location: { kind: "route", route: "/", profile: "keyboard", viewport: "desktop" },
    });
    expect(entryInComparisonCoverage(wrongProfile, routeCoverage)).toBe(false);
  });

  it("returns false when viewport was not compared", () => {
    const entry = baselineEntry({
      location: { kind: "route", route: "/", profile: "default", viewport: "mobile" },
    });
    expect(entryInComparisonCoverage(entry, routeCoverage)).toBe(false);
  });
});

describe("locationInComparisonCoverage", () => {
  it("matches flow checkpoints in coverage", () => {
    const coverage = buildComparisonCoverage(
      auditResult({
        runs: [flowRun({ flowId: "checkout", checkpointId: "open" })],
      }),
    );

    expect(
      locationInComparisonCoverage(
        {
          kind: "flow-checkpoint",
          flowId: "checkout",
          checkpointId: "open",
          profile: "default",
        },
        coverage,
      ),
    ).toBe(true);

    expect(
      locationInComparisonCoverage(
        {
          kind: "flow-checkpoint",
          flowId: "checkout",
          checkpointId: "missing",
          profile: "default",
        },
        coverage,
      ),
    ).toBe(false);
  });
});

describe("runCoversBaselineEntry", () => {
  it("matches completed runs to route entries", () => {
    const entry = baselineEntry();
    expect(runCoversBaselineEntry(entry, run({ route: "/" }))).toBe(true);
    expect(runCoversBaselineEntry(entry, run({ route: "/other" }))).toBe(false);
    expect(runCoversBaselineEntry(entry, run({ status: "failed" }))).toBe(false);
  });

  it("matches completed runs to flow entries", () => {
    const entry = baselineEntry({
      location: {
        kind: "flow-checkpoint",
        flowId: "checkout",
        checkpointId: "open",
        profile: "default",
      },
    });
    expect(
      runCoversBaselineEntry(
        entry,
        flowRun({ flowId: "checkout", checkpointId: "open" }),
      ),
    ).toBe(true);
    expect(
      runCoversBaselineEntry(
        entry,
        flowRun({ flowId: "checkout", checkpointId: "other" }),
      ),
    ).toBe(false);
  });
});
