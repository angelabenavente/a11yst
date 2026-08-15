import { describe, expect, it } from "vitest";
import { mapHtmlSource } from "@a11yst/source-mapping-html";
import { fixtureCatalog } from "./helpers.js";

describe("HTML attribute matching", () => {
  it("maps stable attributes to medium or high without exact", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: {
        tagName: "button",
        attributes: { "data-testid": "confirm-payment" },
      },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).not.toBe("exact");
    expect(result.selected?.provenance).toBe("static-source-index");
  });

  it("filters unknown attributes from evidence", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: {
        tagName: "button",
        attributes: { onclick: "alert(1)", "data-testid": "confirm-payment" },
      },
    });
    expect(result.status).toBe("mapped");
    expect(JSON.stringify(result).includes("alert")).toBe(false);
  });
});

describe("HTML text and accessible name hints", () => {
  it("matches tag plus exact static text as medium", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: { tagName: "button", visibleText: "Confirm" },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("medium");
  });

  it("returns ambiguous for duplicate visible text", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: { tagName: "button", visibleText: "Place order" },
    });
    expect(result.status).toBe("ambiguous");
  });

  it("uses staticAccessibleName hints without claiming exact confidence", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: { accessibleName: "Place order", tagName: "button" },
    });
    expect(result.selected?.confidence).not.toBe("exact");
  });
});
