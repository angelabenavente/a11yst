import { describe, expect, it } from "vitest";
import { mapNextSource, resolveRoutesForPath } from "@a11yst/source-mapping-next";
import { fixtureNextCatalog, fixtureReactCatalog } from "./helpers.js";

describe("Next mapping ambiguity", () => {
  it("returns ambiguous when selector matches layout and page within a route", async () => {
    const routeCatalog = await fixtureNextCatalog(["app-storefront"]);
    const reactCatalog = await fixtureReactCatalog(["app-storefront"]);
    const result = mapNextSource({
      routeCatalog,
      reactCatalog,
      evidence: {
        route: "/checkout",
        router: "app",
        selector: "button#submit-order",
        scopeIds: ["app-storefront"],
      },
    });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
    expect(result.candidates.length).toBeGreaterThan(1);
  });

  it("returns ambiguous when app and pages both match without router hint", async () => {
    const routeCatalog = await fixtureNextCatalog(["hybrid-storefront"]);
    const resolution = resolveRoutesForPath({
      catalog: routeCatalog,
      normalizedRoute: "/about",
      scopeIds: ["hybrid-storefront"],
    });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toBe("ambiguous");
    }
  });
});
