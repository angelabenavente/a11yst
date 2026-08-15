import { describe, expect, it } from "vitest";
import { mapAngularSource, parseAngularSelector } from "@a11yst/source-mapping-angular";
import { fixtureCatalog } from "./helpers.js";

describe("Angular selectors", () => {
  it("accepts supported native selectors", () => {
    expect(parseAngularSelector("button#submit-order").ok).toBe(true);
    expect(parseAngularSelector("button.primary").ok).toBe(true);
  });

  it("maps unique selector to high confidence", async () => {
    const catalog = await fixtureCatalog();
    const result = mapAngularSource({
      catalog,
      evidence: { selector: "button#submit-order", templateKind: "external" },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("high");
    expect(result.selected?.confidence).not.toBe("exact");
  });
});
