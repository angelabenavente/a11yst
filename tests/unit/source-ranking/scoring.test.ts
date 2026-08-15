import { describe, expect, it } from "vitest";
import { BASE_CONFIDENCE_SCORE, computeGroupScore, POSITIVE_SIGNAL_WEIGHTS } from "@a11yst/source-ranking";
import { candidate, duplicateAttributeSignals, sameLocationSelector, signal } from "./fixtures.js";

describe("source ranking scoring", () => {
  it("applies centralized base confidence scores", () => {
    expect(BASE_CONFIDENCE_SCORE.exact).toBe(1000);
    expect(BASE_CONFIDENCE_SCORE.high).toBe(300);
    expect(BASE_CONFIDENCE_SCORE.medium).toBe(180);
    expect(BASE_CONFIDENCE_SCORE.low).toBe(80);
  });

  it("scores positive and negative selector evidence", () => {
    const positive = computeGroupScore({
      candidates: [sameLocationSelector],
      context: {},
      maxSignalsPerCandidate: 64,
    });
    const negative = computeGroupScore({
      candidates: [candidate({
        uri: "src/Button.tsx",
        line: 20,
        confidence: "high",
        provenance: "selector-match",
        signals: [signal("selector", false, "button#save")],
      })],
      context: {},
      maxSignalsPerCandidate: 64,
    });
    expect(positive.score).toBeGreaterThan(negative.score);
    expect(positive.contributions.some((entry) => entry.code === "selector-evidence")).toBe(true);
  });

  it("does not inflate score with duplicate signals", () => {
    const once = computeGroupScore({
      candidates: [candidate({
        uri: "src/Button.tsx",
        line: 1,
        confidence: "high",
        provenance: "selector-match",
        signals: [signal("selector", true, "button#save"), signal("selector", true, "button#save")],
      })],
      context: {},
      maxSignalsPerCandidate: 64,
    });
    expect(once.score).toBe(BASE_CONFIDENCE_SCORE.high + (POSITIVE_SIGNAL_WEIGHTS.selector ?? 0));
  });

  it("keeps score finite and non-negative", () => {
    const scored = computeGroupScore({
      candidates: [candidate({
        uri: "src/Button.tsx",
        line: 1,
        confidence: "low",
        provenance: "text-match",
        signals: duplicateAttributeSignals(100),
      })],
      context: {},
      maxSignalsPerCandidate: 64,
    });
    expect(Number.isFinite(scored.score)).toBe(true);
    expect(scored.score).toBeGreaterThanOrEqual(0);
  });
});
