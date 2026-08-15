import { describe, expect, it, vi } from "vitest";
import * as sourceIndex from "@a11yst/source-index";
import * as htmlCatalog from "@a11yst/source-mapping-html";
import { analyzeFindingSources } from "@a11yst/source-analysis";
import { MONOREPO_FIXTURE, baseFinding, legacyProject } from "./fixtures.js";

describe("catalog caching", () => {
  it("indexes repository once for multiple findings", async () => {
    const indexSpy = vi.spyOn(sourceIndex, "indexRepositorySources");
    const catalogSpy = vi.spyOn(htmlCatalog, "createHtmlSourceCatalog");
    await analyzeFindingSources({
      repositoryRoot: MONOREPO_FIXTURE,
      projects: [legacyProject],
      findings: [
        baseFinding({ id: "a", fingerprint: "a", projectName: "legacy" }),
        baseFinding({ id: "b", fingerprint: "b", projectName: "legacy" }),
      ],
      options: { ranking: false, recommendations: false },
    });
    expect(indexSpy).toHaveBeenCalledTimes(1);
    expect(catalogSpy.mock.calls.length).toBeGreaterThan(0);
    indexSpy.mockRestore();
    catalogSpy.mockRestore();
  });
});
