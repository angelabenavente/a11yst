import { describe, expect, it } from "vitest";
import { fixtureNextCatalog } from "./helpers.js";

describe("Pages Router catalog", () => {
  it("maps index and static pages", async () => {
    const catalog = await fixtureNextCatalog(["pages-storefront"]);
    expect(catalog.routes.some((route) => route.routePattern === "/")).toBe(true);
    expect(catalog.routes.some((route) => route.routePattern === "/about")).toBe(true);
  });

  it("associates _app and _document shared files", async () => {
    const catalog = await fixtureNextCatalog(["pages-storefront"]);
    const about = catalog.routes.find((route) => route.routePattern === "/about");
    expect(about?.sharedUris.some((uri) => uri.endsWith("_app.tsx"))).toBe(true);
    expect(about?.sharedUris.some((uri) => uri.endsWith("_document.tsx"))).toBe(true);
  });

  it("skips api routes", async () => {
    const catalog = await fixtureNextCatalog(["pages-storefront"]);
    expect(catalog.summary.apiRoutesSkipped).toBeGreaterThan(0);
    expect(catalog.files.some((file) => file.uri.includes("/api/"))).toBe(false);
  });
});
