import { describe, expect, it } from "vitest";
import { analyzeFindingSources } from "@a11yst/source-analysis";
import { baseFinding, storefrontProject } from "./fixtures.js";

describe("source analysis fail-soft", () => {
  it("preserves findings when source index is invalid", async () => {
    const finding = baseFinding();
    const result = await analyzeFindingSources({
      repositoryRoot: "/nonexistent/a11yst-source-analysis-root",
      projects: [storefrontProject],
      findings: [finding],
    });
    expect(result.findings[0]).toEqual(finding);
    expect(result.summary.status).toBe("invalid");
    expect(JSON.stringify(result.summary)).not.toContain("stack");
  });
});
