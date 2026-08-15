import { describe, expect, it } from "vitest";
import { computeGroupScore, rankSourceMappingCandidates } from "@a11yst/source-ranking";
import { candidate, reactStrongCandidate, signal, tagOnlyCandidate } from "./fixtures.js";

describe("source ranking context", () => {
  it("applies framework match and mismatch", () => {
    const match = computeGroupScore({ candidates: [reactStrongCandidate], context: { expectedFramework: "react" }, maxSignalsPerCandidate: 64 });
    const mismatch = computeGroupScore({ candidates: [reactStrongCandidate], context: { expectedFramework: "vue" }, maxSignalsPerCandidate: 64 });
    expect(match.score).toBeGreaterThan(mismatch.score);
  });

  it("does not resolve with tag-only evidence", () => {
    expect(rankSourceMappingCandidates({ candidates: [tagOnlyCandidate] }).status).toBe("insufficient");
  });

  it("applies preferred URI without deciding alone", () => {
    const without = rankSourceMappingCandidates({ candidates: [tagOnlyCandidate] });
    const withPreferred = rankSourceMappingCandidates({
      candidates: [tagOnlyCandidate],
      context: { preferredUris: [tagOnlyCandidate.location.uri] },
    });
    expect(without.status).toBe(withPreferred.status);
  });

  it("rejects unsafe preferred URIs", () => {
    expect(rankSourceMappingCandidates({ candidates: [reactStrongCandidate], context: { preferredUris: ["/etc/passwd"] } }).status).toBe("invalid");
  });

  it("handles inverted scope arrays deterministically", () => {
    const scoped = candidate({
      uri: "apps/a.tsx",
      line: 1,
      confidence: "high",
      provenance: "selector-match",
      signals: [signal("framework-metadata", true, "scope-a"), signal("selector", true, "button")],
    });
    const left = rankSourceMappingCandidates({ candidates: [scoped], context: { scopeIds: ["scope-a", "scope-b"] } });
    const right = rankSourceMappingCandidates({ candidates: [scoped], context: { scopeIds: ["scope-b", "scope-a"] } });
    expect(left.ranked[0]?.score).toBe(right.ranked[0]?.score);
  });
});
