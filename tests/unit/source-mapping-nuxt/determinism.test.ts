import { describe, expect, it } from "vitest";
import { stableSerializeNuxtCatalog } from "@a11yst/source-mapping-nuxt";
import { FIXTURE_ROOT, fixtureSourceIndex } from "./helpers.js";
import { createNuxtRouteCatalog } from "@a11yst/source-mapping-nuxt";
import { createVueSourceCatalog } from "@a11yst/source-mapping-vue";

describe("Nuxt determinism", () => {
  it("builds identical catalogs from reversed indexes", async () => {
    const index = fixtureSourceIndex(["nuxt4-store"]);
    const reversed = { ...index, files: [...index.files].reverse() };
    const vueLeft = await createVueSourceCatalog({ repositoryRoot: FIXTURE_ROOT, sourceIndex: index });
    const vueRight = await createVueSourceCatalog({ repositoryRoot: FIXTURE_ROOT, sourceIndex: reversed });
    const left = createNuxtRouteCatalog({ sourceIndex: index, vueCatalog: vueLeft });
    const right = createNuxtRouteCatalog({ sourceIndex: reversed, vueCatalog: vueRight });
    expect(stableSerializeNuxtCatalog(left)).toBe(stableSerializeNuxtCatalog(right));
  });
});
