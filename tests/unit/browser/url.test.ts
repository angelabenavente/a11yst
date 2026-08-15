import { describe, expect, it } from "vitest";
import { buildPageUrl } from "@a11yst/browser";

describe("buildPageUrl", () => {
  it("joins a base URL with the root route", () => {
    expect(buildPageUrl("http://localhost:3000", "/")).toBe("http://localhost:3000/");
  });

  it("joins a base URL with a nested route", () => {
    expect(buildPageUrl("http://localhost:3000", "/pricing/enterprise")).toBe(
      "http://localhost:3000/pricing/enterprise",
    );
  });

  it("does not produce a double slash when baseUrl has a trailing slash", () => {
    expect(buildPageUrl("http://localhost:3000/", "/about")).toBe(
      "http://localhost:3000/about",
    );
  });

  it("does not produce a double slash when routePath omits its leading slash", () => {
    expect(buildPageUrl("http://localhost:3000", "about")).toBe(
      "http://localhost:3000/about",
    );
  });

  it("never produces a double slash when both trailing/leading slashes are present", () => {
    const url = buildPageUrl("http://localhost:3000/", "/about");
    expect(url).not.toMatch(/([^:])\/\//);
  });

  it("preserves query strings", () => {
    expect(buildPageUrl("http://localhost:3000", "/search?q=hello&page=2")).toBe(
      "http://localhost:3000/search?q=hello&page=2",
    );
  });

  it("preserves hash fragments", () => {
    expect(buildPageUrl("http://localhost:3000", "/docs#section-2")).toBe(
      "http://localhost:3000/docs#section-2",
    );
  });

  it("preserves both a query string and a hash fragment, in order", () => {
    expect(buildPageUrl("http://localhost:3000", "/docs?tab=api#section-2")).toBe(
      "http://localhost:3000/docs?tab=api#section-2",
    );
  });

  it("combines a non-root base path with a nested route", () => {
    expect(buildPageUrl("http://localhost:3000/app", "/settings")).toBe(
      "http://localhost:3000/app/settings",
    );
  });

  it("fully replaces baseUrl when routePath is itself an absolute http(s) URL", () => {
    expect(buildPageUrl("http://localhost:3000", "https://example.com/other")).toBe(
      "https://example.com/other",
    );
  });

  it("throws a clear error for an invalid absolute route URL", () => {
    expect(() => buildPageUrl("http://localhost:3000", "http://[::invalid")).toThrow(
      /invalid absolute route url/i,
    );
  });

  it("throws a clear error for an invalid base URL", () => {
    expect(() => buildPageUrl("not-a-url", "/")).toThrow(/invalid base url/i);
  });

  it("never alters baseUrl's origin (protocol/host/port)", () => {
    const url = buildPageUrl("https://example.com:8443", "/path");
    expect(url).toBe("https://example.com:8443/path");
    expect(new URL(url).protocol).toBe("https:");
    expect(new URL(url).port).toBe("8443");
  });

  it("preserves origin when a route path is empty", () => {
    expect(buildPageUrl("http://localhost:3000", "")).toBe("http://localhost:3000/");
  });
});
