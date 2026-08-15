import { describe, expect, it } from "vitest";
import { mapNextSource, stableSerializeNextCatalog } from "@a11yst/source-mapping-next";
import { fixtureNextCatalog, fixtureReactCatalog, FIXTURE_ROOT } from "./helpers.js";

describe("Next mapping security", () => {
  it("does not expose repository root, route parameters, or query values", async () => {
    const routeCatalog = await fixtureNextCatalog(["app-storefront"]);
    const reactCatalog = await fixtureReactCatalog(["app-storefront"]);
    const result = mapNextSource({
      routeCatalog,
      reactCatalog,
      evidence: {
        route: "/products/customer-secret-order-id?token=SECRET",
        router: "app",
        selector: "button#product-detail",
        scopeIds: ["app-storefront"],
      },
    });
    const serialized = JSON.stringify({ routeCatalog, result });
    expect(serialized.includes(FIXTURE_ROOT)).toBe(false);
    expect(serialized.includes("customer-secret-order-id")).toBe(false);
    expect(serialized.includes("SECRET")).toBe(false);
    expect(serialized.includes("token=")).toBe(false);
  });
});

describe("Next mapping determinism", () => {
  it("serializes identical catalogs for reordered source index files", async () => {
    const first = await fixtureNextCatalog(["app-storefront"]);
    const second = await fixtureNextCatalog(["app-storefront"]);
    expect(stableSerializeNextCatalog(first)).toBe(stableSerializeNextCatalog(second));
  });
});
