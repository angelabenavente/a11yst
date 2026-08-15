import { describe, expect, it } from "vitest";
import {
  assertConfiguredTargetOrigin,
  originOf,
  sanitizeUrlForDiagnostics,
  TargetOriginMismatchError,
} from "@a11yst/browser";

describe("target origin verification", () => {
  it("accepts navigation on the configured origin", () => {
    expect(() =>
      assertConfiguredTargetOrigin({
        configuredTargetUrl: "http://localhost:3000/",
        actualPageUrl: "http://localhost:3000/dashboard",
        route: "/dashboard",
      }),
    ).not.toThrow();
  });

  it("rejects unexpected cross-origin navigation", () => {
    expect(() =>
      assertConfiguredTargetOrigin({
        configuredTargetUrl: "http://localhost:3000/",
        actualPageUrl: "http://localhost:5173/",
        route: "/",
      }),
    ).toThrow(TargetOriginMismatchError);

    try {
      assertConfiguredTargetOrigin({
        configuredTargetUrl: "http://localhost:3000/",
        actualPageUrl: "http://localhost:5173/",
        route: "/",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(TargetOriginMismatchError);
      const mismatch = error as TargetOriginMismatchError;
      expect(mismatch.code).toBe("TARGET_ORIGIN_MISMATCH");
      expect(mismatch.configuredOrigin).toBe("http://localhost:3000");
      expect(mismatch.actualOrigin).toBe("http://localhost:5173");
    }
  });

  it("redacts credentials and query strings from diagnostic URLs", () => {
    expect(originOf("http://localhost:3000/app")).toBe("http://localhost:3000");
    expect(sanitizeUrlForDiagnostics("http://user:secret@localhost:3000/app?token=abc")).toBe(
      "http://localhost:3000/app",
    );
  });
});
