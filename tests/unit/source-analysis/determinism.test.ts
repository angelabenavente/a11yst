import { describe, expect, it } from "vitest";
import { analyzeFindingSources, cloneSourceAnalysisInput } from "@a11yst/source-analysis";
import { MONOREPO_FIXTURE, baseFinding, legacyProject, storefrontProject } from "./fixtures.js";

describe("source analysis determinism", () => {
  it("produces identical output for reordered projects", async () => {
    const input = {
      repositoryRoot: MONOREPO_FIXTURE,
      projects: [storefrontProject, legacyProject],
      findings: [baseFinding()],
      options: { ranking: false, recommendations: true },
    };
    const reversed = {
      ...input,
      projects: [legacyProject, storefrontProject],
    };
    const left = await analyzeFindingSources(cloneSourceAnalysisInput(input));
    const right = await analyzeFindingSources(cloneSourceAnalysisInput(reversed));
    expect(JSON.stringify(left.summary)).toBe(JSON.stringify(right.summary));
  });
});
