import { describe, expect, it } from "vitest";
import { mapNuxtSource } from "@a11yst/source-mapping-nuxt";
import { fixtureNuxtCatalog, fixtureVueCatalog } from "./helpers.js";

describe("Nuxt layouts", () => {
  it("associates default layouts with normal routes", async () => {
    const routeCatalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    const checkout = routeCatalog.routes.find((route) => route.routePattern === "/checkout");
    expect(checkout?.layoutUris).toContain("nuxt4/app/layouts/default.vue");
    expect(checkout?.sharedUris).toContain("nuxt4/app/app.vue");
  });

  it("includes named layout only when layoutName hint is provided", async () => {
    const routeCatalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    const vueCatalog = await fixtureVueCatalog(["nuxt4-store"]);
    const defaultLayout = mapNuxtSource({
      routeCatalog,
      vueCatalog,
      evidence: { route: "/checkout", selector: "div#default-layout" },
    });
    const adminLayout = mapNuxtSource({
      routeCatalog,
      vueCatalog,
      evidence: { route: "/checkout", layoutName: "admin", selector: "div#admin-layout" },
    });
    expect(defaultLayout.status).toBe("mapped");
    expect(adminLayout.status).toBe("mapped");
    expect(adminLayout.selected?.location.uri).toContain("admin.vue");
  });
});
