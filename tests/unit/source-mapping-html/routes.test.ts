import { describe, expect, it } from "vitest";
import { mapHtmlSource } from "@a11yst/source-mapping-html";
import { fixtureCatalog } from "./helpers.js";

describe("HTML route narrowing", () => {
  it("narrows candidates using checkout route mappings", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: { route: "/checkout", selector: "#route-button" },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.location.uri).toBe("checkout/index.html");
    expect(result.selected?.confidence).not.toBe("exact");
  });

  it("does not treat route as exact mapping evidence", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: { route: "/checkout", elementId: "route-button" },
    });
    expect(result.selected?.confidence).toBe("high");
    expect(result.selected?.confidence).not.toBe("exact");
  });

  it("rejects absolute route URLs", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: { route: "https://example.com/checkout", selector: "#submit-order" },
    });
    expect(result.candidates.length).toBeGreaterThan(0);
  });
});
