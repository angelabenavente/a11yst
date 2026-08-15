import { describe, expect, it } from "vitest";
import { applyRanking, shouldRunRanking } from "@a11yst/source-analysis";

describe("source analysis ranking", () => {
  it("skips ranking for exact existing locations", () => {
    expect(
      shouldRunRanking(
        { status: "mapped", selected: undefined, candidates: [], diagnostics: [] },
        true,
        true,
      ),
    ).toBe(false);
  });

  it("runs ranking for ambiguous mappings", () => {
    expect(
      shouldRunRanking(
        {
          status: "ambiguous",
          candidates: [
            {
              location: { uri: "a.tsx", region: { start: { line: 1 } } },
              confidence: "high",
              provenance: "selector-match",
              signals: [],
            },
            {
              location: { uri: "b.tsx", region: { start: { line: 2 } } },
              confidence: "high",
              provenance: "selector-match",
              signals: [],
            },
          ],
          diagnostics: [],
        },
        false,
        true,
      ),
    ).toBe(true);
  });

  it("does not elevate confidence through ranking conversion", () => {
    const result = applyRanking(
      {
        status: "ambiguous",
        candidates: [
          {
            location: { uri: "a.tsx", region: { start: { line: 1 } } },
            confidence: "low",
            provenance: "selector-match",
            signals: [],
          },
          {
            location: { uri: "b.tsx", region: { start: { line: 2 } } },
            confidence: "low",
            provenance: "text-match",
            signals: [],
          },
        ],
        diagnostics: [],
      },
      { expectedFramework: "react" },
    );
    expect(result.ranking?.status).not.toBe("resolved");
  });
});
