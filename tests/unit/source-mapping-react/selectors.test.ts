import { describe, expect, it } from "vitest";
import { mapReactSource } from "@a11yst/source-mapping-react";
import { fixtureCatalog } from "./helpers.js";

describe("React selector matching", () => {
  it("maps unique intrinsic selector matches to high confidence without exact", async () => {
    const catalog = await fixtureCatalog();
    const result = mapReactSource({
      catalog,
      evidence: { selector: "button#submit-order" },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("high");
    expect(result.selected?.provenance).toBe("selector-match");
    expect(result.selected?.confidence).not.toBe("exact");
    expect(result.selected?.location.uri).toBe("CheckoutButton.tsx");
  });

  it("returns ambiguous for duplicate selector matches", async () => {
    const catalog = await fixtureCatalog();
    const result = mapReactSource({
      catalog,
      evidence: { selector: "button#duplicate-id" },
    });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
    expect(result.candidates.length).toBeGreaterThan(1);
  });

  it("does not apply selectors to custom component usages", async () => {
    const catalog = await fixtureCatalog();
    const result = mapReactSource({
      catalog,
      evidence: { selector: "CheckoutButton" },
    });
    expect(result.status).not.toBe("mapped");
  });

  it("rejects unsupported selector syntax", async () => {
    const catalog = await fixtureCatalog();
    const result = mapReactSource({
      catalog,
      evidence: { selector: "button:hover" },
    });
    expect(result.status).not.toBe("mapped");
  });
});
