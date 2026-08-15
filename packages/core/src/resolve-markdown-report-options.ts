import type { ResolvedReportsConfig } from "@a11yst/types";

export interface MarkdownReportCliOptions {
  markdown?: boolean;
  noMarkdown?: boolean;
  markdownOutput?: string;
}

export interface ResolvedMarkdownReportOptions {
  enabled: boolean;
  outputPath?: string;
}

export function resolveMarkdownReportOptions(input: {
  config?: Pick<ResolvedReportsConfig, "markdown" | "markdownOutput"> | {
    markdown?: boolean;
    markdownOutput?: string;
  };
  cli?: MarkdownReportCliOptions;
}): ResolvedMarkdownReportOptions {
  const config = input.config ?? { markdown: true };
  const cli = input.cli ?? {};

  if (cli.noMarkdown || cli.markdown === false) {
    return { enabled: false };
  }

  const cliOutput = cli.markdownOutput?.trim();
  if (cliOutput === "") {
    throw new Error("Markdown output path must not be empty.");
  }

  if (cli.markdown || cliOutput) {
    return {
      enabled: true,
      ...(cliOutput ? { outputPath: cliOutput } : {}),
    };
  }

  if (config.markdown === false) {
    return { enabled: false };
  }

  const configOutput = config.markdownOutput?.trim();
  if (configOutput === "") {
    throw new Error("Markdown output path in configuration must not be empty.");
  }
  if (configOutput) {
    return {
      enabled: true,
      outputPath: configOutput,
    };
  }

  return { enabled: true };
}
