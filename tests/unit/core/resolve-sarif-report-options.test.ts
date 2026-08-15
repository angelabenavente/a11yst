import { describe, expect, it } from "vitest";
import { resolveSarifReportOptions } from "@a11yst/core";

describe("resolveSarifReportOptions", () => {
  it("defaults to disabled", () => {
    expect(resolveSarifReportOptions({})).toEqual({ enabled: false });
  });

  it("enables from config", () => {
    expect(
      resolveSarifReportOptions({
        config: { sarif: true, sarifOutput: "./config.sarif" },
      }),
    ).toEqual({ enabled: true, outputPath: "./config.sarif" });
  });

  it("enables from CLI and overrides disabled config", () => {
    expect(
      resolveSarifReportOptions({
        config: { sarif: false },
        cli: { sarif: true },
      }),
    ).toEqual({ enabled: true });
  });

  it("allows CLI --no-sarif to disable config", () => {
    expect(
      resolveSarifReportOptions({
        config: { sarif: true, sarifOutput: "./config.sarif" },
        cli: { noSarif: true },
      }),
    ).toEqual({ enabled: false });
  });

  it("treats CLI output path as enabling", () => {
    expect(
      resolveSarifReportOptions({
        cli: { sarifOutput: "./artifacts/a11yst.sarif" },
      }),
    ).toEqual({ enabled: true, outputPath: "./artifacts/a11yst.sarif" });
  });

  it("prefers CLI output over config output", () => {
    expect(
      resolveSarifReportOptions({
        config: { sarif: true, sarifOutput: "./config.sarif" },
        cli: { sarifOutput: "./cli.sarif" },
      }),
    ).toEqual({ enabled: true, outputPath: "./cli.sarif" });
  });

  it("rejects empty output paths", () => {
    expect(() =>
      resolveSarifReportOptions({ cli: { sarifOutput: "   " } }),
    ).toThrow(/must not be empty/);
  });

  it("accepts unicode and spaces in output paths", () => {
    expect(
      resolveSarifReportOptions({
        cli: { sarifOutput: "./my reports/a11yst 报告.sarif" },
      }).outputPath,
    ).toBe("./my reports/a11yst 报告.sarif");
  });

  it("does not mutate config input", () => {
    const config = { sarif: true, sarifOutput: "./config.sarif" };
    resolveSarifReportOptions({ config, cli: { sarif: true } });
    expect(config).toEqual({ sarif: true, sarifOutput: "./config.sarif" });
  });
});
