import { describe, expect, it } from "vitest";
import { createRankedSourceMappingResult } from "@a11yst/source-ranking";
import { candidate, reactStrongCandidate, reactWeakCandidate, signal } from "./fixtures.js";

describe("source ranking conversion", () => {
  it("maps resolved to mapped", () => {
    expect(createRankedSourceMappingResult([reactStrongCandidate, reactWeakCandidate]).status).toBe("mapped");
  });

  it("maps insufficient to unmapped", () => {
    const result = createRankedSourceMappingResult([candidate({
      uri: "apps/a.tsx",
      line: 1,
      confidence: "low",
      provenance: "text-match",
      signals: [signal("visible-text", true, "Save")],
    })]);
    expect(result.status).toBe("unmapped");
  });

  it("preserves all candidates in conversion", () => {
    const converted = createRankedSourceMappingResult([reactStrongCandidate, reactWeakCandidate]);
    expect(converted.candidates).toHaveLength(2);
  });
});

describe("source ranking ambiguous conversion", () => {
  it("maps ambiguous ranking to ambiguous result", () => {
    const converted = createRankedSourceMappingResult([
      candidate({ uri: "apps/a.tsx", line: 1, confidence: "high", provenance: "selector-match", signals: [signal("selector", true, "button#a")] }),
      candidate({ uri: "apps/b.tsx", line: 1, confidence: "high", provenance: "selector-match", signals: [signal("selector", true, "button#b")] }),
    ], undefined, { minimumWinningMargin: 9999 });
    expect(converted.status).toBe("ambiguous");
    expect(converted.selected).toBeUndefined();
  });
});
