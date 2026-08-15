import { describe, expect, it } from "vitest";
import { validateConfig } from "@a11yst/config";
import { resolveSourceAnalysisOptions } from "@a11yst/source-analysis";

describe("source analysis config", () => {
  it("defaults to enabled ranking and recommendations", () => {
    expect(resolveSourceAnalysisOptions(undefined)).toEqual({
      enabled: true,
      ranking: true,
      recommendations: true,
    });
  });

  it("accepts empty sourceAnalysis object", () => {
    const config = validateConfig({
      projects: [{ name: "site", platform: "web", baseUrl: "http://localhost:3000" }],
      sourceAnalysis: {},
    });
    expect(config.sourceAnalysis).toEqual({
      enabled: true,
      ranking: true,
      recommendations: true,
    });
  });

  it("rejects invalid sourceAnalysis.enabled", () => {
    expect(() =>
      validateConfig({
        projects: [{ name: "site", platform: "web", baseUrl: "http://localhost:3000" }],
        sourceAnalysis: { enabled: "yes" as never },
      }),
    ).toThrow();
  });
});
