import { describe, expect, it } from "vitest";
import {
  createReactSourceCatalog,
  mapReactSource,
  stableSerializeReactCatalog,
} from "@a11yst/source-mapping-react";
import { fixtureCatalog, FIXTURE_ROOT, fixtureSourceIndex } from "./helpers.js";

describe("React mapping security", () => {
  it("does not serialize secrets, source code, or absolute paths", async () => {
    const catalog = await fixtureCatalog();
    const result = mapReactSource({
      catalog,
      evidence: { attributes: { "data-testid": "safe-button" } },
    });
    const serialized = JSON.stringify({ catalog, result });
    expect(serialized.includes(FIXTURE_ROOT)).toBe(false);
    expect(serialized.includes("SuperSecretPassword123")).toBe(false);
    expect(serialized.includes("ABC123SECRET")).toBe(false);
    expect(serialized.includes("Bearer secret-token")).toBe(false);
    expect(serialized.includes("javascript:alert")).toBe(false);
    expect(serialized.includes("onClick")).toBe(false);
    expect(serialized.includes("import ")).toBe(false);
  });

  it("rejects unsafe uri escapes", async () => {
    const catalog = await createReactSourceCatalog({
      repositoryRoot: FIXTURE_ROOT,
      sourceIndex: {
        ...fixtureSourceIndex(),
        files: [
          {
            uri: "../outside/CheckoutButton.tsx",
            kind: "tsx",
            extension: ".tsx",
            sizeBytes: 1,
            scopeIds: ["legacy"],
          },
        ],
      },
    });
    expect(catalog.status).toBe("invalid");
  });
});

describe("React mapping determinism", () => {
  it("returns identical catalogs and mappings for reordered index files", async () => {
    const index = fixtureSourceIndex();
    const reversed = {
      ...index,
      files: [...index.files].reverse(),
    };
    const first = await createReactSourceCatalog({
      repositoryRoot: FIXTURE_ROOT,
      sourceIndex: index,
    });
    const second = await createReactSourceCatalog({
      repositoryRoot: FIXTURE_ROOT,
      sourceIndex: reversed,
    });
    expect(stableSerializeReactCatalog(first)).toBe(stableSerializeReactCatalog(second));

    const evidence = { selector: "button#submit-order" };
    expect(mapReactSource({ catalog: first, evidence })).toEqual(
      mapReactSource({ catalog: second, evidence }),
    );
  });
});
