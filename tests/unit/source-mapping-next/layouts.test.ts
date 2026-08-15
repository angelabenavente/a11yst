import { describe, expect, it } from "vitest";
import { fixtureNextCatalog } from "./helpers.js";

describe("Next layout associations", () => {
  it("includes ancestor layouts and templates for checkout", async () => {
    const catalog = await fixtureNextCatalog(["app-storefront"]);
    const checkout = catalog.routes.find((route) => route.routePattern === "/checkout");
    expect(checkout?.layoutUris.some((uri) => uri.endsWith("src/app/layout.tsx"))).toBe(true);
    expect(checkout?.layoutUris.some((uri) => uri.includes("checkout/layout.tsx"))).toBe(true);
    expect(checkout?.templateUris.some((uri) => uri.includes("checkout/template.tsx"))).toBe(true);
  });
});
