import { describe, expect, it, vi } from "vitest";
import * as recommendations from "@a11yst/recommendations";
import { analyzeFindingSources } from "@a11yst/source-analysis";
import { MONOREPO_FIXTURE, baseFinding, storefrontProject } from "./fixtures.js";

describe("source analysis recommendations", () => {
  it("calls recommendation engine once per finding when enabled", async () => {
    const spy = vi.spyOn(recommendations, "createAccessibilityRecommendations");
    await analyzeFindingSources({
      repositoryRoot: MONOREPO_FIXTURE,
      projects: [storefrontProject],
      findings: [baseFinding(), baseFinding({ id: "b", fingerprint: "b" })],
      options: { ranking: false, recommendations: true },
    });
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("omits recommendations when disabled", async () => {
    const result = await analyzeFindingSources({
      repositoryRoot: MONOREPO_FIXTURE,
      projects: [storefrontProject],
      findings: [baseFinding()],
      options: { recommendations: false },
    });
    expect(result.findings[0]?.recommendations).toBeUndefined();
  });
});
