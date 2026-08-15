import { describe, expect, it } from "vitest";
import { normalizeSourceUri, UnsafeSourceUriError } from "@a11yst/source-mapping";

describe("normalizeSourceUri", () => {
  it("accepts relative repository paths", () => {
    expect(normalizeSourceUri("src/Button.tsx")).toBe("src/Button.tsx");
    expect(normalizeSourceUri("src/components/Checkout Button.tsx")).toBe(
      "src/components/Checkout Button.tsx",
    );
    expect(normalizeSourceUri("packages/ui/src/Dialog.vue")).toBe("packages/ui/src/Dialog.vue");
  });

  it("preserves unicode", () => {
    expect(normalizeSourceUri("src/café/ボタン.tsx")).toBe("src/café/ボタン.tsx");
  });

  it("normalizes windows separators and dot segments", () => {
    expect(normalizeSourceUri("./src/Button.tsx")).toBe("src/Button.tsx");
    expect(normalizeSourceUri("src\\Button.tsx")).toBe("src/Button.tsx");
    expect(normalizeSourceUri("src/components/./Button.tsx")).toBe("src/components/Button.tsx");
  });

  it("rejects unix absolute paths", () => {
    expect(() => normalizeSourceUri("/src/Button.tsx")).toThrow(UnsafeSourceUriError);
  });

  it("rejects windows absolute paths", () => {
    expect(() => normalizeSourceUri("C:\\repo\\src\\Button.tsx")).toThrow(UnsafeSourceUriError);
  });

  it("rejects unc paths", () => {
    expect(() => normalizeSourceUri("\\\\server\\share\\File.tsx")).toThrow(UnsafeSourceUriError);
  });

  it("rejects file urls", () => {
    expect(() => normalizeSourceUri("file:///repo/src/Button.tsx")).toThrow(UnsafeSourceUriError);
  });

  it("rejects http and https urls", () => {
    expect(() => normalizeSourceUri("https://example.com/Button.tsx")).toThrow(
      UnsafeSourceUriError,
    );
    expect(() => normalizeSourceUri("http://example.com/Button.tsx")).toThrow(
      UnsafeSourceUriError,
    );
  });

  it("rejects traversal", () => {
    expect(() => normalizeSourceUri("../src/Button.tsx")).toThrow(UnsafeSourceUriError);
    expect(() => normalizeSourceUri("src/../../secret.txt")).toThrow(UnsafeSourceUriError);
  });

  it("rejects null bytes and empty paths", () => {
    expect(() => normalizeSourceUri("src\0Button.tsx")).toThrow(UnsafeSourceUriError);
    expect(() => normalizeSourceUri("")).toThrow(UnsafeSourceUriError);
  });

  it("rejects control characters", () => {
    expect(() => normalizeSourceUri("src/\u0007Button.tsx")).toThrow(UnsafeSourceUriError);
  });

  it("does not mutate input", () => {
    const input = "./src\\Button.tsx";
    const copy = `${input}`;
    normalizeSourceUri(input);
    expect(input).toBe(copy);
  });
});
