import { describe, expect, it } from "vitest";
import { fixtureNuxtCatalog } from "./helpers.js";
import { normalizeNuxtRoutePath, resolveRoutesForPath } from "@a11yst/source-mapping-nuxt";

describe("Nuxt route catalog", () => {
  it("detects Nuxt 4 app/pages and Nuxt 3 pages roots", async () => {
    const catalog = await fixtureNuxtCatalog();
    expect(catalog.summary.nuxt4PageRoots).toBeGreaterThan(0);
    expect(catalog.summary.nuxt3PageRoots).toBeGreaterThan(0);
    expect(catalog.routes.some((route) => route.routePattern === "/checkout")).toBe(true);
  });

  it("uses only indexed files without filesystem traversal", async () => {
    const catalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    expect(catalog.routes.length).toBeGreaterThan(0);
    expect(catalog.files.every((file) => file.uri.startsWith("nuxt4/"))).toBe(true);
  });
});

describe("Nuxt route matching", () => {
  it("normalizes query, fragment, and trailing slash", () => {
    expect(normalizeNuxtRoutePath("/checkout/?step=1#dialog")).toBe("/checkout");
    expect(normalizeNuxtRoutePath("https://example.com/x")).toBeUndefined();
  });

  it("prefers static routes over dynamic routes", async () => {
    const catalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    const resolution = resolveRoutesForPath({
      routeCatalog: catalog,
      normalizedPath: "/products/new",
    });
    expect(resolution.status).toBe("matched");
    expect(resolution.status === "matched" ? resolution.routes[0]?.routePattern : "").toBe("/products/new");
  });
});

describe("Nuxt nested routes", () => {
  it("associates parent pages with NuxtPage outlets", async () => {
    const catalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    const child = catalog.routes.find((route) => route.routePattern === "/parent/child");
    expect(child?.parentPageUris).toContain("nuxt4/app/pages/parent.vue");
  });
});
