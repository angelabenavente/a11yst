import type { ResolvedReportsConfig } from "@a11yst/types";

export interface SarifReportCliOptions {
  sarif?: boolean;
  noSarif?: boolean;
  sarifOutput?: string;
}

export interface ResolvedSarifReportOptions {
  enabled: boolean;
  outputPath?: string;
}

export function resolveSarifReportOptions(input: {
    config?: Pick<ResolvedReportsConfig, "sarif" | "sarifOutput"> | { sarif?: boolean; sarifOutput?: string };
  cli?: SarifReportCliOptions;
}): ResolvedSarifReportOptions {
  const config = input.config ?? { sarif: false };
  const cli = input.cli ?? {};

  if (cli.noSarif) {
    return { enabled: false };
  }

  const cliOutput = cli.sarifOutput?.trim();
  if (cliOutput === "") {
    throw new Error("SARIF output path must not be empty.");
  }

  if (cli.sarif || cliOutput) {
    return {
      enabled: true,
      ...(cliOutput ? { outputPath: cliOutput } : {}),
    };
  }

  if (config.sarif) {
    const configOutput = config.sarifOutput?.trim();
    if (configOutput === "") {
      throw new Error("SARIF output path in configuration must not be empty.");
    }
    return {
      enabled: true,
      ...(configOutput ? { outputPath: configOutput } : {}),
    };
  }

  return { enabled: false };
}
