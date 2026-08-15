import { describe, expect, it } from "vitest";
import { mapNuxtSource } from "@a11yst/source-mapping-nuxt";
import { fixtureNuxtCatalog, fixtureVueCatalog } from "./helpers.js";

describe("Nuxt ambiguity", () => {
  it("does not prefer page over app shell when both match", async () => {
    const routeCatalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    const vueCatalog = await fixtureVueCatalog(["nuxt4-store"]);
    const result = mapNuxtSource({
      routeCatalog,
      vueCatalog,
      evidence: { route: "/", selector: "button#home-cta" },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.location.uri).toContain("index.vue");
  });
});
