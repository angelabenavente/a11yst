import type { ResolvedReportsConfig } from "@a11yst/types";

export interface JunitReportCliOptions {
  junit?: boolean;
  noJunit?: boolean;
  junitOutput?: string;
}

export interface ResolvedJunitReportOptions {
  enabled: boolean;
  outputPath?: string;
}

export function resolveJunitReportOptions(input: {
  config?: Pick<ResolvedReportsConfig, "junit" | "junitOutput"> | {
    junit?: boolean;
    junitOutput?: string;
  };
  cli?: JunitReportCliOptions;
}): ResolvedJunitReportOptions {
  const config = input.config ?? { junit: false };
  const cli = input.cli ?? {};

  if (cli.noJunit) {
    return { enabled: false };
  }

  const cliOutput = cli.junitOutput?.trim();
  if (cliOutput === "") {
    throw new Error("JUnit output path must not be empty.");
  }

  if (cli.junit || cliOutput) {
    return {
      enabled: true,
      ...(cliOutput ? { outputPath: cliOutput } : {}),
    };
  }

  if (config.junit) {
    const configOutput = config.junitOutput?.trim();
    if (configOutput === "") {
      throw new Error("JUnit output path in configuration must not be empty.");
    }
    return {
      enabled: true,
      ...(configOutput ? { outputPath: configOutput } : {}),
    };
  }

  return { enabled: false };
}
