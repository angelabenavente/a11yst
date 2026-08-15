import { describe, expect, it } from "vitest";
import {
  applyBaselineUpdate,
  compareBaselineWithAudit,
  previewBaselineUpdate,
} from "@a11yst/baseline";
import {
  auditResult,
  baselineEntry,
  baselineFile,
  finding,
  fixedClock,
  run,
  FIXED_NOW,
} from "./fixtures.js";

const BASELINE_PATH = ".a11yst/baseline.json";

function buildComparison(
  baseline = baselineFile(),
  findings = auditResult().findings,
  runs = [run({ route: "/" })],
) {
  return compareBaselineWithAudit(
    baseline,
    auditResult({ runs, findings }),
    {
      baselinePath: BASELINE_PATH,
      clock: fixedClock(FIXED_NOW),
      comparedAt: FIXED_NOW,
    },
  );
}

describe("previewBaselineUpdate", () => {
  it("previews added, removed, unchanged, and regressed entries", () => {
    const known = baselineEntry({ fingerprint: "known-fp" });
    const resolved = baselineEntry({
      fingerprint: "resolved-fp",
      location: { kind: "route", route: "/gone", profile: "default" },
    });
    const regressed = baselineEntry({ fingerprint: "regressed-fp", severity: "medium" });
    const baseline = baselineFile({ entries: [known, resolved, regressed] });

    const comparison = buildComparison(
      baseline,
      [
        finding({ fingerprint: "known-fp" }),
        finding({ fingerprint: "new-fp", ruleId: "new-rule" }),
        finding({ fingerprint: "regressed-fp", severity: "critical" }),
      ],
      [run({ route: "/" }), run({ route: "/gone" })],
    );

    const preview = previewBaselineUpdate(baseline, comparison);

    expect(preview.added.map((entry) => entry.fingerprint)).toEqual(["new-fp"]);
    expect(preview.removed.map((entry) => entry.fingerprint)).toEqual(["resolved-fp"]);
    expect(preview.unchanged.map((entry) => entry.fingerprint)).toEqual(["known-fp"]);
    expect(preview.regressed.map((entry) => entry.fingerprint)).toEqual(["regressed-fp"]);
    expect(preview.hasChanges).toBe(true);
  });

  it("reports hasChanges false when only regressions are present", () => {
    const regressed = baselineEntry({ severity: "medium" });
    const baseline = baselineFile({ entries: [regressed] });
    const comparison = buildComparison(
      baseline,
      [finding({ severity: "critical" })],
    );

    const preview = previewBaselineUpdate(baseline, comparison);
    expect(preview.regressed).toHaveLength(1);
    expect(preview.added).toHaveLength(0);
    expect(preview.removed).toHaveLength(0);
    expect(preview.hasChanges).toBe(false);
  });
});

describe("applyBaselineUpdate", () => {
  it("returns undefined for dry-run when no actionable flags are set", () => {
    const baseline = baselineFile({
      entries: [baselineEntry({ fingerprint: "resolved-fp" })],
    });
    const comparison = buildComparison(baseline, [], [run({ route: "/" })]);

    expect(applyBaselineUpdate(baseline, comparison, {})).toBeUndefined();
  });

  it("accepts new findings when acceptNew is true", () => {
    const baseline = baselineFile({ entries: [] });
    const newFinding = finding({ fingerprint: "brand-new", ruleId: "brand-new" });
    const comparison = buildComparison(baseline, [newFinding]);

    const updated = applyBaselineUpdate(baseline, comparison, {
      acceptNew: true,
      now: FIXED_NOW,
    });

    expect(updated?.entries).toHaveLength(1);
    expect(updated?.entries[0]?.fingerprint).toBe("brand-new");
    expect(updated?.entries[0]?.firstSeenAt).toBe(FIXED_NOW);
    expect(updated?.updatedAt).toBe(FIXED_NOW);
  });

  it("removes resolved findings when removeResolved is true", () => {
    const resolved = baselineEntry({ fingerprint: "resolved-fp" });
    const baseline = baselineFile({ entries: [resolved] });
    const comparison = buildComparison(baseline, [], [run({ route: "/" })]);

    const updated = applyBaselineUpdate(baseline, comparison, {
      removeResolved: true,
      now: FIXED_NOW,
    });

    expect(updated?.entries).toHaveLength(0);
    expect(updated?.updatedAt).toBe(FIXED_NOW);
  });

  it("does not silently accept regressed findings when acceptNew is true", () => {
    const regressed = baselineEntry({ severity: "medium" });
    const baseline = baselineFile({ entries: [regressed] });
    const comparison = buildComparison(
      baseline,
      [finding({ severity: "critical" })],
    );

    const updated = applyBaselineUpdate(baseline, comparison, {
      acceptNew: true,
      now: FIXED_NOW,
    });

    expect(updated).toBeUndefined();
    expect(baseline.entries).toHaveLength(1);
    expect(baseline.entries[0]?.severity).toBe("medium");
  });

  it("can accept new and remove resolved in one update", () => {
    const resolved = baselineEntry({
      fingerprint: "resolved-fp",
      location: { kind: "route", route: "/gone", profile: "default" },
    });
    const baseline = baselineFile({ entries: [resolved] });
    const comparison = buildComparison(
      baseline,
      [finding({ fingerprint: "added-fp", ruleId: "added" })],
      [run({ route: "/" }), run({ route: "/gone" })],
    );

    const updated = applyBaselineUpdate(baseline, comparison, {
      acceptNew: true,
      removeResolved: true,
      now: FIXED_NOW,
    });

    expect(updated?.entries.map((entry) => entry.fingerprint)).toEqual(["added-fp"]);
  });
});
