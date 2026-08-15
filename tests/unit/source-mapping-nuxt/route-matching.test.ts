import { describe, expect, it } from "vitest";
import { matchPathToPattern, pathSegmentsFromRoute } from "@a11yst/source-mapping-nuxt";

describe("Nuxt route matching", () => {
  it("matches catch-all only when segments exist", () => {
    const pattern = [{ kind: "static" as const, value: "docs" }, { kind: "catch-all" as const, name: "slug" }];
    expect(matchPathToPattern(pathSegmentsFromRoute("/docs/a"), pattern)).toBe(true);
    expect(matchPathToPattern(pathSegmentsFromRoute("/docs"), pattern)).toBe(false);
  });

  it("matches optional segments at root", () => {
    const pattern = [{ kind: "optional" as const, name: "optional" }];
    expect(matchPathToPattern(pathSegmentsFromRoute("/"), pattern)).toBe(true);
    expect(matchPathToPattern(pathSegmentsFromRoute("/test"), pattern)).toBe(true);
  });
});
