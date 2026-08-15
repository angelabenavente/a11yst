import { describe, expect, it } from "vitest";
import { stableSerializeNuxtCatalog } from "@a11yst/source-mapping-nuxt";
import { fixtureNuxtCatalog } from "./helpers.js";

describe("Nuxt security", () => {
  it("does not retain concrete route parameter values", async () => {
    const catalog = await fixtureNuxtCatalog(["nuxt4-store"]);
    const serialized = stableSerializeNuxtCatalog(catalog);
    expect(serialized).toContain("[id]");
    expect(serialized).not.toContain("customer-secret");
  });
});

describe("Nuxt determinism", () => {
  it("serializes catalogs deterministically", async () => {
    const left = await fixtureNuxtCatalog(["nuxt4-store"]);
    const right = await fixtureNuxtCatalog(["nuxt4-store"]);
    expect(stableSerializeNuxtCatalog(left)).toBe(stableSerializeNuxtCatalog(right));
  });
});

describe("Nuxt compatibility", () => {
  it("keeps route catalog version stable", async () => {
    const catalog = await fixtureNuxtCatalog();
    expect(catalog.version).toBe(1);
  });
});
