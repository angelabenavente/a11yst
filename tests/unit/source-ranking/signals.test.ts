import { describe, expect, it } from "vitest";
import { computeGroupScore, rankSourceMappingCandidates } from "@a11yst/source-ranking";
import { candidate, exactCandidateA, exactCandidateB, mediumStrongCandidate, reactStrongCandidate, reactWeakCandidate, signal, tagOnlyCandidate } from "./fixtures.js";

describe("source ranking signals", () => {
  it("deduplicates identical signals", () => {
    const scored = computeGroupScore({
      candidates: [candidate({
        uri: "src/a.tsx",
        line: 1,
        confidence: "high",
        provenance: "selector-match",
        signals: [
          signal("selector", true, "button#save"),
          signal("selector", true, "button#save"),
        ],
      })],
      context: {},
      maxSignalsPerCandidate: 64,
    });
    expect(scored.contributions.filter((entry) => entry.code === "selector-evidence")).toHaveLength(1);
  });
});

describe("source ranking context", () => {
  it("applies framework match and mismatch", () => {
    const match = computeGroupScore({
      candidates: [reactStrongCandidate],
      context: { expectedFramework: "react" },
      maxSignalsPerCandidate: 64,
    });
    const mismatch = computeGroupScore({
      candidates: [reactStrongCandidate],
      context: { expectedFramework: "vue" },
      maxSignalsPerCandidate: 64,
    });
    expect(match.score).toBeGreaterThan(mismatch.score);
  });

  it("does not resolve with tag-only evidence", () => {
    const result = rankSourceMappingCandidates({ candidates: [tagOnlyCandidate] });
    expect(result.status).toBe("insufficient");
  });
});

describe("source ranking exact mappings", () => {
  it("resolves a single exact candidate over heuristics", () => {
    const result = rankSourceMappingCandidates({
      candidates: [reactWeakCandidate, exactCandidateA],
    });
    expect(result.status).toBe("resolved");
    expect(result.selected?.representative.confidence).toBe("exact");
  });

  it("returns ambiguous for conflicting exact locations", () => {
    const result = rankSourceMappingCandidates({ candidates: [exactCandidateA, exactCandidateB] });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
  });
});

describe("source ranking ambiguity", () => {
  it("keeps equal-score candidates ambiguous", () => {
    const left = candidate({ uri: "apps/a.tsx", line: 1, confidence: "high", provenance: "selector-match", signals: [signal("selector", true, "button#a")] });
    const right = candidate({ uri: "apps/b.tsx", line: 1, confidence: "high", provenance: "selector-match", signals: [signal("selector", true, "button#b")] });
    const result = rankSourceMappingCandidates({ candidates: [left, right], options: { minimumWinningMargin: 9999 } });
    expect(result.status).toBe("ambiguous");
  });
});

describe("source ranking confidence", () => {
  it("never increases confidence through ranking", () => {
    const result = rankSourceMappingCandidates({
      candidates: [reactStrongCandidate, reactWeakCandidate],
    });
    expect(result.selected?.effectiveConfidence).not.toBe("exact");
    expect(result.selected?.representative.confidence).toBe("high");
  });

  it("can resolve medium with multiple strong signals", () => {
    const result = rankSourceMappingCandidates({ candidates: [mediumStrongCandidate, reactWeakCandidate] });
    expect(result.status).toBe("resolved");
    expect(result.selected?.effectiveConfidence).toBe("medium");
  });
});

describe("source ranking limits", () => {
  it("rejects invalid option values", () => {
    const result = rankSourceMappingCandidates({
      candidates: [reactStrongCandidate],
      options: { maxCandidates: 0 },
    });
    expect(result.status).toBe("invalid");
  });
});

describe("source ranking security", () => {
  it("rejects unsafe preferred URIs", () => {
    const result = rankSourceMappingCandidates({
      candidates: [reactStrongCandidate],
      context: { preferredUris: ["/etc/passwd"] },
    });
    expect(result.status).toBe("invalid");
  });
});

describe("source ranking determinism", () => {
  it("produces identical results for reordered candidates", () => {
    const left = rankSourceMappingCandidates({ candidates: [reactStrongCandidate, reactWeakCandidate] });
    const right = rankSourceMappingCandidates({ candidates: [reactWeakCandidate, reactStrongCandidate] });
    expect(left.status).toBe(right.status);
    expect(left.selected?.location.uri).toBe(right.selected?.location.uri);
    expect(left.ranked[0]?.score).toBe(right.ranked[0]?.score);
  });
});

describe("source ranking conversion", () => {
  it("maps resolved ranking to mapped SourceMappingResult", async () => {
    const { createRankedSourceMappingResult } = await import("@a11yst/source-ranking");
    const result = createRankedSourceMappingResult([reactStrongCandidate, reactWeakCandidate]);
    expect(result.status).toBe("mapped");
    expect(result.selected?.location.uri).toContain("CheckoutButton.tsx");
  });
});

describe("source ranking compatibility", () => {
  it("keeps createSourceMappingResult ambiguous without ranking", async () => {
    const { createSourceMappingResult } = await import("@a11yst/source-mapping");
    const result = createSourceMappingResult([
      candidate({ uri: "apps/a.tsx", line: 1, confidence: "high", provenance: "selector-match", signals: [signal("selector", true, "button#a")] }),
      candidate({ uri: "apps/b.tsx", line: 1, confidence: "high", provenance: "selector-match", signals: [signal("selector", true, "button#b")] }),
    ]);
    expect(result.status).toBe("ambiguous");
  });
});
