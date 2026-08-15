import { describe, expect, it } from "vitest";
import { normalizeRelativeUri, validateSourceLocation } from "../../../packages/sarif/src/source-location.js";

describe("source location validation", () => {
  it("accepts relative repository paths and positive line numbers", () => {
    expect(normalizeRelativeUri("src/components/Button.tsx")).toBe("src/components/Button.tsx");
    expect(
      validateSourceLocation({
        uri: "src/components/Button.tsx",
        startLine: 10,
        startColumn: 2,
        endLine: 12,
        endColumn: 4,
      }),
    ).toEqual({
      uri: "src/components/Button.tsx",
      region: {
        startLine: 10,
        startColumn: 2,
        endLine: 12,
        endColumn: 4,
      },
    });
  });

  it("normalizes Windows separators", () => {
    expect(normalizeRelativeUri("src\\components\\Button.tsx")).toBe("src/components/Button.tsx");
  });

  it("rejects absolute, file, and traversal paths", () => {
    expect(normalizeRelativeUri("/etc/passwd")).toBeUndefined();
    expect(normalizeRelativeUri("C:\\secret\\file.ts")).toBeUndefined();
    expect(normalizeRelativeUri("file:///tmp/x.ts")).toBeUndefined();
    expect(normalizeRelativeUri("src/../secret.ts")).toBeUndefined();
  });

  it("rejects invalid line numbers and end before start", () => {
    expect(validateSourceLocation({ uri: "src/a.ts", startLine: 0 })).toBeUndefined();
    expect(
      validateSourceLocation({ uri: "src/a.ts", startLine: 5, endLine: 4 }),
    ).toBeUndefined();
    expect(
      validateSourceLocation({
        uri: "src/a.ts",
        startLine: 5,
        startColumn: 10,
        endLine: 5,
        endColumn: 2,
      }),
    ).toBeUndefined();
  });
});
