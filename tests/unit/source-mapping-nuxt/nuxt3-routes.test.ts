import { describe, expect, it } from "vitest";
import { fixtureNuxtCatalog } from "./helpers.js";

describe("Nuxt 3 routes", () => {
  it("catalogs pages root routes", async () => {
    const catalog = await fixtureNuxtCatalog(["nuxt3-store"]);
    expect(catalog.routes.some((route) => route.routePattern === "/")).toBe(true);
    expect(catalog.routes.some((route) => route.routePattern === "/about")).toBe(true);
    expect(catalog.routes.some((route) => route.routePattern === "/blog")).toBe(true);
    expect(catalog.routes.some((route) => route.routePattern === "/blog/[slug]")).toBe(true);
  });
});
