import { describe, expect, it } from "vitest";
import { createFindingFingerprint } from "@a11yst/browser";
import { analyzeFindingSources } from "@a11yst/source-analysis";
import { MONOREPO_FIXTURE, baseFinding, storefrontProject } from "./fixtures.js";

describe("source analysis compatibility", () => {
  it("does not change finding fingerprints", async () => {
    const finding = baseFinding();
    const expected = createFindingFingerprint({
      ruleId: finding.ruleId,
      projectName: finding.projectName,
      route: finding.route,
      profile: finding.profile,
      viewport: finding.viewport,
      target: finding.target,
    });
    const result = await analyzeFindingSources({
      repositoryRoot: MONOREPO_FIXTURE,
      projects: [storefrontProject],
      findings: [finding],
    });
    expect(result.findings[0]?.fingerprint).toBe(expected);
  });
});
