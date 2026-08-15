import { describe, expect, it } from "vitest";
import { createNextRouteCatalog } from "@a11yst/source-mapping-next";
import { fixtureNextCatalog, fixtureReactCatalog, fixtureSourceIndex, FIXTURE_ROOT } from "./helpers.js";

describe("Next route catalog", () => {
  it("detects app and pages router roots from indexed next scopes", async () => {
    const catalog = await fixtureNextCatalog(["app-storefront"]);
    expect(catalog.summary.appRouterRoots).toBeGreaterThan(0);
    const pagesCatalog = await fixtureNextCatalog(["pages-storefront"]);
    expect(pagesCatalog.summary.pagesRouterRoots).toBeGreaterThan(0);
  });

  it("uses source index and react catalog without reading the filesystem directly", async () => {
    const reactCatalog = await fixtureReactCatalog();
    const catalog = createNextRouteCatalog({
      sourceIndex: fixtureSourceIndex(),
      reactCatalog,
    });
    expect(catalog.routes.length).toBeGreaterThan(0);
    expect(JSON.stringify(catalog).includes(FIXTURE_ROOT)).toBe(false);
  });

  it("rejects invalid options", async () => {
    const reactCatalog = await fixtureReactCatalog();
    const catalog = createNextRouteCatalog({
      sourceIndex: fixtureSourceIndex(),
      reactCatalog,
      options: { maxRoutes: 0 },
    });
    expect(catalog.status).toBe("invalid");
  });
});
