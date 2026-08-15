import { describe, expect, it } from "vitest";
import { fixtureNuxtCatalog } from "./helpers.js";

describe("Nuxt 4 routes", () => {
  it("catalogs route groups, dynamic, catch-all, and optional routes", async () => {
    const catalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    expect(catalog.routes.some((route) => route.routePattern === "/products/new")).toBe(true);
    expect(catalog.routes.some((route) => route.routePattern === "/products/[id]")).toBe(true);
    expect(catalog.routes.some((route) => route.routePattern === "/docs/[...slug]")).toBe(true);
    expect(catalog.routes.some((route) => route.routePattern === "/[[optional]]")).toBe(true);
  });
});
