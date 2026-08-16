import { describe, expect, it } from "vitest";
import {
  escapeGitHubCommandMessage,
  escapeGitHubCommandProperty,
  serializeGitHubAnnotationCommand,
} from "@a11yst/reporters";

describe("escapeGitHubCommandProperty", () => {
  it("percent-encodes workflow command delimiters", () => {
    expect(escapeGitHubCommandProperty('title:with,commas\r\n')).toBe(
      "title%3Awith%2Ccommas%0D%0A",
    );
  });

  it("encodes percent signs first", () => {
    expect(escapeGitHubCommandProperty("100% done")).toBe("100%25 done");
  });
});

describe("escapeGitHubCommandMessage", () => {
  it("percent-encodes newlines and colons", () => {
    expect(escapeGitHubCommandMessage("line1\nline2%:done")).toBe("line1%0Aline2%25%3Adone");
  });
});

describe("serializeGitHubAnnotationCommand", () => {
  it("serializes a basic error annotation", () => {
    expect(
      serializeGitHubAnnotationCommand({
        level: "error",
        title: "a11yst: button-name",
        message: "New serious accessibility finding.",
      }),
    ).toBe("::error title=a11yst%3A button-name::New serious accessibility finding.::");
  });

  it("includes file and line properties when provided", () => {
    expect(
      serializeGitHubAnnotationCommand({
        level: "error",
        title: "a11yst: button-name",
        message: "Finding at source.",
        file: "src/App.tsx",
        line: 10,
        column: 3,
        endLine: 10,
        endColumn: 15,
      }),
    ).toBe(
      "::error file=src/App.tsx,line=10,col=3,endLine=10,endColumn=15,title=a11yst%3A button-name::Finding at source.::",
    );
  });

  it("prevents command injection via title and message", () => {
    const command = serializeGitHubAnnotationCommand({
      level: "error",
      title: "evil::notice title=pwned::",
      message: "payload::warning ::injection::",
    });
    expect(command).not.toContain("::notice");
    expect(command).not.toContain("::warning");
    expect(command).toMatch(/^::error title=evil%3A%3Anotice/);
    expect(command).toContain("payload%3A%3Awarning %3A%3Ainjection%3A%3A");
    expect(command.endsWith("::")).toBe(true);
  });
});
