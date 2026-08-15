import { describe, expect, it } from "vitest";
import { mapHtmlSource } from "@a11yst/source-mapping-html";
import { fixtureCatalog } from "./helpers.js";

describe("HTML selector matching", () => {
  it("maps a unique selector to high confidence without exact", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: { selector: "#submit-order" },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("high");
    expect(result.selected?.provenance).toBe("selector-match");
    expect(result.selected?.location.uri).toBe("legacy-checkout.html");
  });

  it("returns ambiguous for duplicate selector matches", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: { selector: "#dup-id" },
    });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
    expect(result.candidates.length).toBeGreaterThan(1);
  });

  it("returns unmapped for unsupported dynamic pseudo selectors", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: { selector: "button:hover" },
    });
    expect(result.status).not.toBe("mapped");
  });

  it("matches class and attribute selectors", async () => {
    const catalog = await fixtureCatalog();
    const byClass = mapHtmlSource({ catalog, evidence: { selector: "button.primary" } });
    expect(byClass.candidates.length).toBeGreaterThan(0);
    const byAttr = mapHtmlSource({
      catalog,
      evidence: { selector: 'button[data-testid="confirm-payment"]' },
    });
    expect(byAttr.status).toBe("mapped");
  });
});

describe("HTML id and tag matching", () => {
  it("maps a unique id to high confidence", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: { elementId: "submit-order", tagName: "button" },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("high");
  });

  it("does not create candidates from tag alone", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({ catalog, evidence: { tagName: "button" } });
    expect(result.status).toBe("unmapped");
  });

  it("returns ambiguous for duplicate ids", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({ catalog, evidence: { elementId: "dup-id" } });
    expect(result.status).toBe("ambiguous");
  });
});
