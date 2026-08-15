import { describe, expect, it } from "vitest";
import { rankSourceMappingCandidates } from "@a11yst/source-ranking";
import { candidate, reactStrongCandidate, signal } from "./fixtures.js";

describe("source ranking limits", () => {
  it("rejects zero maxCandidates", () => {
    expect(rankSourceMappingCandidates({ candidates: [reactStrongCandidate], options: { maxCandidates: 0 } }).status).toBe("invalid");
  });

  it("truncates candidates deterministically", () => {
    const many = Array.from({ length: 10 }, (_, index) => candidate({
      uri: `apps/file-${index}.tsx`,
      line: 1,
      confidence: "medium",
      provenance: "text-match",
      signals: [signal("visible-text", true, `text-${index}`)],
    }));
    const result = rankSourceMappingCandidates({ candidates: many.reverse(), options: { maxCandidates: 3 } });
    expect(result.diagnostics.some((entry) => entry.code === "candidate-limit-reached")).toBe(true);
    expect(result.status).not.toBe("resolved");
  });
});
