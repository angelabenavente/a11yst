import { describe, expect, it } from "vitest";
import {
  matchPathToPattern,
  normalizeNextRoutePath,
  pathSegmentsFromRoute,
  resolveRoutesForPath,
} from "@a11yst/source-mapping-next";
import { fixtureNextCatalog } from "./helpers.js";

describe("Next route matching", () => {
  it("normalizes trailing slashes, query, and fragments", () => {
    expect(normalizeNextRoutePath("/checkout/")).toBe("/checkout");
    expect(normalizeNextRoutePath("/checkout?step=payment")).toBe("/checkout");
    expect(normalizeNextRoutePath("/checkout#dialog")).toBe("/checkout");
  });

  it("rejects unsafe routes", () => {
    expect(normalizeNextRoutePath("https://example.com/checkout")).toBeUndefined();
    expect(normalizeNextRoutePath("/../secret")).toBeUndefined();
  });

  it("prefers static routes over dynamic routes", async () => {
    const catalog = await fixtureNextCatalog(["app-storefront"]);
    const resolution = resolveRoutesForPath({
      catalog,
      normalizedRoute: "/products/new",
      routerHint: "app",
      scopeIds: ["app-storefront"],
    });
    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.routes[0]?.routePattern).toBe("/products/new");
    }
  });

  it("matches catch-all and optional catch-all paths", async () => {
    const catalog = await fixtureNextCatalog(["app-storefront"]);
    const catchAll = catalog.routes.find((route) => route.routePattern === "/docs/[...slug]");
    expect(
      matchPathToPattern(pathSegmentsFromRoute("/docs/a/b"), catchAll!.segments),
    ).toBe(true);
    expect(matchPathToPattern(pathSegmentsFromRoute("/docs"), catchAll!.segments)).toBe(false);

    const optional = catalog.routes.find((route) => route.routePattern === "/docs/[[...optional]]");
    expect(matchPathToPattern(pathSegmentsFromRoute("/docs"), optional!.segments)).toBe(true);
  });
});
