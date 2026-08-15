import { describe, expect, it } from "vitest";
import { fixtureNextCatalog } from "./helpers.js";

describe("App Router catalog", () => {
  it("derives checkout route without route group segment", async () => {
    const catalog = await fixtureNextCatalog(["app-storefront"]);
    const checkout = catalog.routes.find(
      (route) => route.router === "app" && route.routePattern === "/checkout",
    );
    expect(checkout?.routeGroupNames).toContain("shop");
    expect(checkout?.pageUris.some((uri) => uri.includes("checkout/page.tsx"))).toBe(true);
  });

  it("catalogs dynamic, catch-all, and optional catch-all routes", async () => {
    const catalog = await fixtureNextCatalog(["app-storefront"]);
    expect(catalog.routes.some((route) => route.routePattern === "/products/[id]")).toBe(true);
    expect(catalog.routes.some((route) => route.routePattern === "/docs/[...slug]")).toBe(true);
    expect(catalog.routes.some((route) => route.routePattern === "/docs/[[...optional]]")).toBe(true);
  });

  it("skips route handlers and private folders", async () => {
    const catalog = await fixtureNextCatalog(["app-storefront"]);
    expect(catalog.summary.routeHandlersSkipped).toBeGreaterThan(0);
    expect(catalog.routes.some((route) => route.routePattern.includes("_private"))).toBe(false);
  });
});
