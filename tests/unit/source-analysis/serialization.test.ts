import { describe, expect, it } from "vitest";
import { analyzeFindingSources } from "@a11yst/source-analysis";
import { MONOREPO_FIXTURE, baseFinding, storefrontProject } from "./fixtures.js";

describe("source analysis serialization", () => {
  it("returns JSON-safe results without undefined", async () => {
    const result = await analyzeFindingSources({
      repositoryRoot: MONOREPO_FIXTURE,
      projects: [storefrontProject],
      findings: [baseFinding()],
    });
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(JSON.stringify(result)).not.toContain("undefined");
  });
});
