import { describe, expect, it } from "vitest";
import { generateJunit, serializeJunit } from "@a11yst/junit";
import {
  escapeXmlAttribute,
  escapeXmlText,
  sanitizeXmlString,
} from "../../../packages/junit/src/xml.js";
import { failedRouteRun } from "./fixtures.js";

describe("sanitizeXmlString", () => {
  it("removes illegal XML 1.0 control characters", () => {
    expect(sanitizeXmlString("hello\u0000world")).toBe("hello world");
    expect(sanitizeXmlString("a\u0008b\u000Bc\u000Cd")).toBe("a b c d");
  });

  it("preserves tab, newline, and carriage return then normalizes whitespace", () => {
    expect(sanitizeXmlString("line one\nline two\t tab")).toBe("line one line two tab");
  });

  it("replaces surrogate pairs and non-characters", () => {
    expect(sanitizeXmlString("before\uD800after")).toBe("before after");
    expect(sanitizeXmlString("x\uFFFEy\uFFFFz")).toBe("x y z");
  });
});

describe("escapeXmlAttribute", () => {
  it("escapes reserved characters and collapses whitespace", () => {
    expect(escapeXmlAttribute(`Tom & "Jerry" <3 'cats'`)).toBe(
      "Tom &amp; &quot;Jerry&quot; &lt;3 &apos;cats&apos;",
    );
    expect(escapeXmlAttribute("multi\nline\tvalue")).toBe("multi line value");
  });

  it("sanitizes illegal characters before escaping", () => {
    expect(escapeXmlAttribute("secret\u0000token")).toBe("secret token");
  });
});

describe("escapeXmlText", () => {
  it("escapes reserved characters and normalizes whitespace", () => {
    expect(escapeXmlText(`Error: 2 < 3 & 5 > 1`)).toBe("Error: 2 &lt; 3 &amp; 5 &gt; 1");
    expect(escapeXmlText("first\r\nsecond")).toBe("first second");
  });

  it("sanitizes illegal characters before escaping", () => {
    expect(escapeXmlText("value\u0001with\u0002controls")).toBe("value with controls");
  });
});

describe("escaping through serialized output", () => {
  it("round-trips escaped attribute values in generated XML", () => {
    const xml = serializeJunit(
      generateJunit({
        product: { name: "a11yst", version: "0.1.0" },
        audit: { successful: false, durationMs: 1 },
        findings: [],
        runs: [
          failedRouteRun({
            diagnostics: [
              {
                code: "message",
                severity: "error",
                message: `Say "hello" & <goodbye>`,
              },
            ],
          }),
        ],
      }).document,
    );
    expect(xml).toContain("&quot;hello&quot;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;goodbye&gt;");
  });
});
