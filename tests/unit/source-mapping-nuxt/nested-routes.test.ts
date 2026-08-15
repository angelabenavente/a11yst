import { describe, expect, it } from "vitest";
import { fixtureNuxtCatalog } from "./helpers.js";

describe("Nuxt nested routes", () => {
  it("includes parent page only when NuxtPage is present", async () => {
    const catalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    const child = catalog.routes.find((route) => route.routePattern === "/parent/child");
    expect(child?.parentPageUris).toEqual(["nuxt4/app/pages/parent.vue"]);
    expect(child?.pageUris).toEqual(["nuxt4/app/pages/parent/child.vue"]);
  });
});
