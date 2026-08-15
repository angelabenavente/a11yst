import { describe, expect, it } from "vitest";
import { mapNextSource, stableSerializeNextCatalog } from "@a11yst/source-mapping-next";
import { fixtureNextCatalog, fixtureReactCatalog, fixtureSourceIndex } from "./helpers.js";

describe("Next mapping determinism", () => {
  it("returns identical mappings for reordered evidence fields", async () => {
    const routeCatalog = await fixtureNextCatalog(["app-storefront"]);
    const reactCatalog = await fixtureReactCatalog(["app-storefront"]);
    const first = mapNextSource({
      routeCatalog,
      reactCatalog,
      evidence: {
        route: "/checkout",
        router: "app",
        selector: "button[aria-label=\"Place order\"]",
        scopeIds: ["app-storefront"],
      },
    });
    const second = mapNextSource({
      routeCatalog,
      reactCatalog,
      evidence: {
        scopeIds: ["app-storefront"],
        selector: "button[aria-label=\"Place order\"]",
        router: "app",
        route: "/checkout",
      },
    });
    expect(first).toEqual(second);
  });

  it("does not mutate evidence input", async () => {
    const routeCatalog = await fixtureNextCatalog(["app-storefront"]);
    const reactCatalog = await fixtureReactCatalog(["app-storefront"]);
    const evidence = { route: "/checkout", router: "app" as const, selector: "button#submit-order" };
    const snapshot = structuredClone(evidence);
    mapNextSource({ routeCatalog, reactCatalog, evidence });
    expect(evidence).toEqual(snapshot);
  });

  it("builds stable catalogs from shuffled index order", async () => {
    const index = fixtureSourceIndex(["app-storefront"]);
    const reversed = { ...index, files: [...index.files].reverse() };
    const reactA = await fixtureReactCatalog(["app-storefront"]);
    const reactB = await fixtureReactCatalog(["app-storefront"]);
    const first = stableSerializeNextCatalog(
      (await import("@a11yst/source-mapping-next")).createNextRouteCatalog({
        sourceIndex: index,
        reactCatalog: reactA,
        scopeIds: ["app-storefront"],
      }),
    );
    const second = stableSerializeNextCatalog(
      (await import("@a11yst/source-mapping-next")).createNextRouteCatalog({
        sourceIndex: reversed,
        reactCatalog: reactB,
        scopeIds: ["app-storefront"],
      }),
    );
    expect(first).toBe(second);
  });
});
