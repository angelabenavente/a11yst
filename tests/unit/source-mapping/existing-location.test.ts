import { describe, expect, it } from "vitest";
import { createMappingFromExistingSourceLocation } from "@a11yst/source-mapping";
import {
  existingHtmlSourceLocation,
  invalidLineLocation,
  traversalPathLocation,
  unsafeAbsolutePathLocation,
} from "./fixtures.js";

describe("createMappingFromExistingSourceLocation", () => {
  it("returns unmapped when absent", () => {
    const result = createMappingFromExistingSourceLocation(undefined);
    expect(result.status).toBe("unmapped");
    expect(result.selected).toBeUndefined();
    expect(result.candidates).toEqual([]);
    expect(result.diagnostics.some((d) => d.code === "missing-source-location")).toBe(true);
  });

  it("returns mapped exact for valid existing location", () => {
    const result = createMappingFromExistingSourceLocation(existingHtmlSourceLocation);
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("exact");
    expect(result.selected?.provenance).toBe("existing-source-location");
    expect(result.selected?.location.uri).toBe("apps/legacy/public/checkout.html");
    expect(result.selected?.location.region.start).toEqual({ line: 18, column: 5 });
    expect(result.candidates).toHaveLength(1);
  });

  it("normalizes windows separators in existing location", () => {
    const result = createMappingFromExistingSourceLocation({
      uri: "apps\\legacy\\public\\checkout.html",
      startLine: 18,
      startColumn: 5,
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.location.uri).toBe("apps/legacy/public/checkout.html");
  });

  it("returns invalid for absolute paths", () => {
    const result = createMappingFromExistingSourceLocation(unsafeAbsolutePathLocation);
    expect(result.status).toBe("invalid");
    expect(result.selected).toBeUndefined();
    expect(result.candidates).toEqual([]);
    expect(result.diagnostics.some((d) => d.level === "error")).toBe(true);
  });

  it("returns invalid for traversal paths", () => {
    const result = createMappingFromExistingSourceLocation(traversalPathLocation);
    expect(result.status).toBe("invalid");
  });

  it("returns invalid for invalid line numbers", () => {
    const result = createMappingFromExistingSourceLocation(invalidLineLocation);
    expect(result.status).toBe("invalid");
  });

  it("does not access filesystem", () => {
    const result = createMappingFromExistingSourceLocation({
      uri: "missing/file/that/does/not/exist.ts",
      startLine: 1,
    });
    expect(result.status).toBe("mapped");
  });

  it("does not mutate input", () => {
    const input = structuredClone(existingHtmlSourceLocation);
    createMappingFromExistingSourceLocation(input);
    expect(input).toEqual(existingHtmlSourceLocation);
  });
});
