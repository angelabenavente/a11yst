import { describe, expect, it } from "vitest";
import { stableSerializeNuxtCatalog, normalizeNuxtRoutePath } from "@a11yst/source-mapping-nuxt";
import { fixtureNuxtCatalog } from "./helpers.js";

describe("Nuxt security", () => {
  it("rejects unsafe routes and omits secrets from serialization", async () => {
    expect(normalizeNuxtRoutePath("/../secret")).toBeUndefined();
    const catalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    const serialized = stableSerializeNuxtCatalog(catalog);
    expect(serialized).not.toContain("nuxt.config");
    expect(serialized).not.toContain(".nuxt");
  });
});
