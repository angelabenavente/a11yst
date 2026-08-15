import { describe, expect, it } from "vitest";
import { mapNextSource } from "@a11yst/source-mapping-next";
import { fixtureNextCatalog, fixtureReactCatalog } from "./helpers.js";

describe("Next source mapping", () => {
  it("maps a unique selector within a narrowed checkout route", async () => {
    const routeCatalog = await fixtureNextCatalog(["app-storefront"]);
    const reactCatalog = await fixtureReactCatalog(["app-storefront"]);
    const result = mapNextSource({
      routeCatalog,
      reactCatalog,
      evidence: {
        route: "/checkout",
        router: "app",
        selector: "button[aria-label=\"Place order\"]",
        scopeIds: ["app-storefront"],
      },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("high");
    expect(result.selected?.framework).toBe("next");
    expect(result.selected?.next?.routePattern).toBe("/checkout");
    expect(result.selected?.location.uri).toContain("checkout/page.tsx");
  });

  it("returns exact mappings for valid existing source locations", async () => {
    const routeCatalog = await fixtureNextCatalog(["app-storefront"]);
    const reactCatalog = await fixtureReactCatalog(["app-storefront"]);
    const result = mapNextSource({
      routeCatalog,
      reactCatalog,
      evidence: {
        route: "/checkout",
        existingSourceLocation: {
          uri: "app-router/src/app/(shop)/checkout/page.tsx",
          startLine: 2,
          startColumn: 10,
        },
      },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("exact");
  });
});
