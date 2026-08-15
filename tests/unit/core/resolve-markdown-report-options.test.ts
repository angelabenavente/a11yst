import { describe, expect, it } from "vitest";
import { resolveMarkdownReportOptions } from "@a11yst/core";

describe("resolveMarkdownReportOptions", () => {
  it("defaults to enabled", () => {
    expect(resolveMarkdownReportOptions({})).toEqual({ enabled: true });
  });

  it("allows explicit config disable", () => {
    expect(resolveMarkdownReportOptions({ config: { markdown: false } })).toEqual({
      enabled: false,
    });
  });

  it("enables from config", () => {
    expect(
      resolveMarkdownReportOptions({
        config: { markdown: true, markdownOutput: "./config.md" },
      }),
    ).toEqual({ enabled: true, outputPath: "./config.md" });
  });

  it("enables from CLI output path even when config disables markdown", () => {
    expect(
      resolveMarkdownReportOptions({
        config: { markdown: false },
        cli: { markdownOutput: "./artifacts/a11yst.md" },
      }),
    ).toEqual({ enabled: true, outputPath: "./artifacts/a11yst.md" });
  });

  it("allows CLI --no-markdown to disable config", () => {
    expect(
      resolveMarkdownReportOptions({
        config: { markdown: true, markdownOutput: "./config.md" },
        cli: { noMarkdown: true },
      }),
    ).toEqual({ enabled: false });
  });

  it("allows Commander markdown=false from --no-markdown", () => {
    expect(
      resolveMarkdownReportOptions({
        config: { markdown: true, markdownOutput: "./config.md" },
        cli: { markdown: false },
      }),
    ).toEqual({ enabled: false });
  });

  it("treats CLI output path as enabling", () => {
    expect(
      resolveMarkdownReportOptions({
        cli: { markdownOutput: "./artifacts/a11yst.md" },
      }),
    ).toEqual({ enabled: true, outputPath: "./artifacts/a11yst.md" });
  });

  it("prefers CLI output over config output", () => {
    expect(
      resolveMarkdownReportOptions({
        config: { markdown: true, markdownOutput: "./config.md" },
        cli: { markdownOutput: "./cli.md" },
      }),
    ).toEqual({ enabled: true, outputPath: "./cli.md" });
  });

  it("rejects empty output paths", () => {
    expect(() =>
      resolveMarkdownReportOptions({ cli: { markdownOutput: "   " } }),
    ).toThrow(/must not be empty/);
  });

  it("accepts unicode and spaces in output paths", () => {
    expect(
      resolveMarkdownReportOptions({
        cli: { markdownOutput: "./my reports/a11yst 报告.md" },
      }).outputPath,
    ).toBe("./my reports/a11yst 报告.md");
  });

  it("does not mutate config input", () => {
    const config = { markdown: true, markdownOutput: "./config.md" };
    resolveMarkdownReportOptions({ config, cli: { markdown: true } });
    expect(config).toEqual({ markdown: true, markdownOutput: "./config.md" });
  });
});
