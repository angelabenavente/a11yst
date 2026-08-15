import { describe, expect, it } from "vitest";
import { mapReactSource, stableSerializeReactCatalog } from "@a11yst/source-mapping-react";
import { createReactSourceCatalog } from "@a11yst/source-mapping-react";
import { fixtureCatalog, FIXTURE_ROOT, fixtureSourceIndex } from "./helpers.js";

describe("React mapping determinism", () => {
  it("keeps stable serialization without timestamps", async () => {
    const catalog = await fixtureCatalog();
    const serialized = stableSerializeReactCatalog(catalog);
    expect(serialized.includes("202")).toBe(false);
    expect(serialized.includes("mtime")).toBe(false);
  });

  it("returns identical mappings for reordered evidence fields", async () => {
    const catalog = await fixtureCatalog();
    const first = mapReactSource({
      catalog,
      evidence: {
        tagName: "button",
        attributes: { "data-testid": "checkout-button" },
        classNames: ["btn-primary", "btn"],
      },
    });
    const second = mapReactSource({
      catalog,
      evidence: {
        classNames: ["btn", "btn-primary"],
        attributes: { "data-testid": "checkout-button" },
        tagName: "button",
      },
    });
    expect(first).toEqual(second);
  });

  it("does not mutate evidence input", async () => {
    const catalog = await fixtureCatalog();
    const evidence = { selector: "button#submit-order", scopeIds: ["storefront"] };
    const snapshot = structuredClone(evidence);
    mapReactSource({ catalog, evidence });
    expect(evidence).toEqual(snapshot);
  });

  it("builds deterministic catalogs for shuffled source index files", async () => {
    const shuffled = {
      ...fixtureSourceIndex(),
      files: [...fixtureSourceIndex().files].sort((left, right) =>
        right.uri.localeCompare(left.uri),
      ),
    };
    const ordered = await createReactSourceCatalog({
      repositoryRoot: FIXTURE_ROOT,
      sourceIndex: fixtureSourceIndex(),
    });
    const reversed = await createReactSourceCatalog({
      repositoryRoot: FIXTURE_ROOT,
      sourceIndex: shuffled,
    });
    expect(stableSerializeReactCatalog(ordered)).toBe(stableSerializeReactCatalog(reversed));
  });
});
