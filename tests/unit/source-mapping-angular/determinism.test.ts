import { describe, expect, it } from "vitest";
import { createAngularSourceCatalog, mapAngularSource, stableSerializeAngularCatalog } from "@a11yst/source-mapping-angular";
import { fixtureCatalog, fixtureSourceIndex, FIXTURE_ROOT } from "./helpers.js";

describe("Angular determinism", () => {
  it("produces identical catalogs for reordered indexes", async () => {
    const index = fixtureSourceIndex();
    const reversed = { ...index, files: [...index.files].reverse() };
    const left = await fixtureCatalog();
    const right = await createAngularSourceCatalog({ repositoryRoot: FIXTURE_ROOT, sourceIndex: reversed });
    expect(stableSerializeAngularCatalog(left)).toBe(stableSerializeAngularCatalog(right));
  });

  it("produces identical mapping for reordered evidence attributes", async () => {
    const catalog = await fixtureCatalog();
    const left = mapAngularSource({
      catalog,
      evidence: {
        attributes: { "data-testid": "checkout-submit", role: "button" },
        tagName: "button",
        templateKind: "external",
      },
    });
    const right = mapAngularSource({
      catalog,
      evidence: {
        attributes: { role: "button", "data-testid": "checkout-submit" },
        tagName: "button",
        templateKind: "external",
      },
    });
    expect(left.status).toBe(right.status);
    expect(left.selected?.location.uri).toBe(right.selected?.location.uri);
  });
});
