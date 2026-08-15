import { describe, expect, it } from "vitest";
import { mapNextSource } from "@a11yst/source-mapping-next";
import { fixtureNextCatalog, fixtureReactCatalog } from "./helpers.js";

describe("Next special files", () => {
  it("excludes loading files unless a role hint is provided", async () => {
    const routeCatalog = await fixtureNextCatalog(["app-storefront"]);
    const reactCatalog = await fixtureReactCatalog(["app-storefront"]);
    const withoutHint = mapNextSource({
      routeCatalog,
      reactCatalog,
      evidence: { route: "/checkout", selector: "p" },
    });
    expect(withoutHint.candidates.every((candidate) => !candidate.location.uri.endsWith("loading.tsx"))).toBe(
      true,
    );
  });
});
