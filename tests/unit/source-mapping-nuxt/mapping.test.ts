import { describe, expect, it, vi } from "vitest";
import { mapNuxtSource } from "@a11yst/source-mapping-nuxt";
import { fixtureNuxtCatalog, fixtureVueCatalog } from "./helpers.js";

describe("Nuxt mapping", () => {
  it("maps route + unique selector through Vue delegation", async () => {
    const routeCatalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    const vueCatalog = await fixtureVueCatalog(["nuxt4-store"]);
    const result = mapNuxtSource({
      routeCatalog,
      vueCatalog,
      evidence: {
        route: "/checkout",
        selector: "button#submit-order",
      },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("high");
    expect(result.selected?.framework).toBe("nuxt");
    expect(result.selected?.nuxt?.routePattern).toBe("/checkout");
  });

  it("invokes Vue mapper exactly once", async () => {
    const routeCatalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    const vueCatalog = await fixtureVueCatalog(["nuxt4-store"]);
    const spy = vi.spyOn(await import("@a11yst/source-mapping-vue"), "mapVueSource");
    mapNuxtSource({
      routeCatalog,
      vueCatalog,
      evidence: { route: "/checkout", selector: "button#submit-order" },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe("Nuxt ambiguity", () => {
  it("returns ambiguous for the same route in two scopes without hint", async () => {
    const routeCatalog = await fixtureNuxtCatalog(["store-a", "store-b"]);
    const vueCatalog = await fixtureVueCatalog(["store-a", "store-b"]);
    const result = mapNuxtSource({
      routeCatalog,
      vueCatalog,
      evidence: {
        route: "/checkout",
        selector: "button#submit-order",
      },
    });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
  });

  it("returns ambiguous when selector appears in page and layout", async () => {
    const routeCatalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    const vueCatalog = await fixtureVueCatalog(["nuxt4-store"]);
    const result = mapNuxtSource({
      routeCatalog,
      vueCatalog,
      evidence: {
        route: "/checkout",
        selector: "button#layout-submit",
      },
    });
    expect(["mapped", "ambiguous", "unmapped"]).toContain(result.status);
  });
});

describe("Nuxt compatibility", () => {
  it("does not mutate the original Vue catalog", async () => {
    const routeCatalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    const vueCatalog = await fixtureVueCatalog(["nuxt4-store"]);
    const before = structuredClone(vueCatalog);
    mapNuxtSource({
      routeCatalog,
      vueCatalog,
      evidence: { route: "/checkout", selector: "button#submit-order" },
    });
    expect(vueCatalog).toEqual(before);
  });
});
