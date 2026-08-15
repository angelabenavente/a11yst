import { describe, expect, it } from "vitest";
import { resolveJunitReportOptions } from "@a11yst/core";

describe("resolveJunitReportOptions", () => {
  it("defaults to disabled", () => {
    expect(resolveJunitReportOptions({})).toEqual({ enabled: false });
  });

  it("enables from config", () => {
    expect(
      resolveJunitReportOptions({
        config: { junit: true, junitOutput: "./config.junit.xml" },
      }),
    ).toEqual({ enabled: true, outputPath: "./config.junit.xml" });
  });

  it("enables from CLI and overrides disabled config", () => {
    expect(
      resolveJunitReportOptions({
        config: { junit: false },
        cli: { junit: true },
      }),
    ).toEqual({ enabled: true });
  });

  it("allows CLI --no-junit to disable config", () => {
    expect(
      resolveJunitReportOptions({
        config: { junit: true, junitOutput: "./config.junit.xml" },
        cli: { noJunit: true },
      }),
    ).toEqual({ enabled: false });
  });

  it("treats CLI output path as enabling", () => {
    expect(
      resolveJunitReportOptions({
        cli: { junitOutput: "./artifacts/a11yst.junit.xml" },
      }),
    ).toEqual({ enabled: true, outputPath: "./artifacts/a11yst.junit.xml" });
  });

  it("prefers CLI output over config output", () => {
    expect(
      resolveJunitReportOptions({
        config: { junit: true, junitOutput: "./config.junit.xml" },
        cli: { junitOutput: "./cli.junit.xml" },
      }),
    ).toEqual({ enabled: true, outputPath: "./cli.junit.xml" });
  });

  it("rejects empty output paths", () => {
    expect(() =>
      resolveJunitReportOptions({ cli: { junitOutput: "   " } }),
    ).toThrow(/must not be empty/);
  });

  it("accepts unicode and spaces in output paths", () => {
    expect(
      resolveJunitReportOptions({
        cli: { junitOutput: "./my reports/a11yst 报告.junit.xml" },
      }).outputPath,
    ).toBe("./my reports/a11yst 报告.junit.xml");
  });

  it("does not mutate config input", () => {
    const config = { junit: true, junitOutput: "./config.junit.xml" };
    resolveJunitReportOptions({ config, cli: { junit: true } });
    expect(config).toEqual({ junit: true, junitOutput: "./config.junit.xml" });
  });
});
