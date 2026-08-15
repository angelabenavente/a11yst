import { describe, expect, it } from "vitest";
import { buildSourceAnalysisScopes } from "@a11yst/source-analysis";
import { legacyProject, storefrontProject } from "./fixtures.js";

describe("source analysis scopes", () => {
  it("sorts scopes deterministically", () => {
    const { scopes } = buildSourceAnalysisScopes([storefrontProject, legacyProject]);
    expect(scopes.map((scope) => scope.id)).toEqual(["legacy", "storefront"]);
  });

  it("normalizes framework aliases", () => {
    const { scopes } = buildSourceAnalysisScopes([
      { id: "app", rootUri: ".", framework: "nextjs" },
    ]);
    expect(scopes[0]?.framework).toBe("next");
  });

  it("rejects unsafe scope roots", () => {
    const { diagnostics } = buildSourceAnalysisScopes([
      { id: "bad", rootUri: "../outside", framework: "react" },
    ]);
    expect(diagnostics.some((entry) => entry.code === "source-analysis-project-invalid")).toBe(true);
  });
});
