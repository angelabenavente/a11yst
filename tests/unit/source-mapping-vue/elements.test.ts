import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "./helpers.js";

describe("Vue elements and text", () => {
  it("indexes class names and accessible name hints", async () => {
    const catalog = await fixtureCatalog();
    const button = catalog.files
      .flatMap((file) => file.elements)
      .find((element) => element.staticAttributes.id === "submit-order");
    expect(button?.classNames).toContain("primary-btn");
    expect(button?.staticAccessibleName).toBe("Place order");
  });
});
