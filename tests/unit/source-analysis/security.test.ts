import { describe, expect, it } from "vitest";
import { analyzeFindingSources } from "@a11yst/source-analysis";
import { MONOREPO_FIXTURE, baseFinding, storefrontProject } from "./fixtures.js";

describe("source analysis security", () => {
  it("does not expose repository root or secrets in summary", async () => {
    const result = await analyzeFindingSources({
      repositoryRoot: MONOREPO_FIXTURE,
      projects: [storefrontProject],
      findings: [
        baseFinding({
          target: ["input[type=password]"],
          html: "<input type='password' value='secret'>",
        }),
      ],
      options: { ranking: false },
    });
    const serialized = JSON.stringify(result.summary);
    expect(serialized).not.toContain(MONOREPO_FIXTURE);
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("<input");
  });
});
