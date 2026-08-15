import { describe, expect, it, vi } from "vitest";
import * as htmlMapper from "@a11yst/source-mapping-html";
import { analyzeFindingSources } from "@a11yst/source-analysis";
import { MONOREPO_FIXTURE, baseFinding, legacyProject, storefrontProject } from "./fixtures.js";

describe("source analysis orchestration", () => {
  it("returns disabled summary without indexing", async () => {
    const indexSpy = vi.spyOn(await import("@a11yst/source-index"), "indexRepositorySources");
    const result = await analyzeFindingSources({
      repositoryRoot: MONOREPO_FIXTURE,
      projects: [storefrontProject],
      findings: [baseFinding()],
      options: { enabled: false },
    });
    expect(result.summary.status).toBe("disabled");
    expect(indexSpy).not.toHaveBeenCalled();
    indexSpy.mockRestore();
  });

  it("enriches findings without mutating input", async () => {
    const finding = baseFinding();
    const input = {
      repositoryRoot: MONOREPO_FIXTURE,
      projects: [storefrontProject],
      findings: [finding],
      options: { ranking: false, recommendations: true },
    };
    const original = structuredClone(input);
    const result = await analyzeFindingSources(input);
    expect(input).toEqual(original);
    expect(result.findings[0]?.sourceMapping).toBeDefined();
    expect(result.findings[0]?.recommendations).toBeDefined();
    expect(result.summary.analyzedFindings).toBe(1);
  });

  it("uses html mapper for vanilla alias", async () => {
    const mapSpy = vi.spyOn(htmlMapper, "mapHtmlSource");
    await analyzeFindingSources({
      repositoryRoot: MONOREPO_FIXTURE,
      projects: [{ ...legacyProject, framework: "vanilla" }],
      findings: [baseFinding({ projectName: "legacy", route: "/", target: ["button#save"] })],
      options: { ranking: false, recommendations: false },
    });
    expect(mapSpy).toHaveBeenCalled();
    mapSpy.mockRestore();
  });

  it("uses next mapper for next projects", async () => {
    const nextSpy = vi.spyOn(await import("@a11yst/source-mapping-next"), "mapNextSource");
    await analyzeFindingSources({
      repositoryRoot: MONOREPO_FIXTURE,
      projects: [storefrontProject],
      findings: [baseFinding()],
      options: { ranking: false, recommendations: false },
    });
    expect(nextSpy).toHaveBeenCalled();
    nextSpy.mockRestore();
  });
});
