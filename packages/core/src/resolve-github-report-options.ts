import type { ResolvedReportsConfig } from "@a11yst/types";

export interface GitHubAnnotationsCliOptions {
  githubAnnotations?: boolean;
  noGitHubAnnotations?: boolean;
  githubAnnotationsOutput?: string;
}

export interface ResolvedGitHubAnnotationsOptions {
  enabled: boolean;
  outputPath?: string;
}

export function resolveGitHubAnnotationsOptions(input: {
  config?: Pick<ResolvedReportsConfig, "githubAnnotations" | "githubAnnotationsOutput"> | {
    githubAnnotations?: boolean;
    githubAnnotationsOutput?: string;
  };
  cli?: GitHubAnnotationsCliOptions;
}): ResolvedGitHubAnnotationsOptions {
  const config = input.config ?? { githubAnnotations: false };
  const cli = input.cli ?? {};

  if (cli.noGitHubAnnotations) {
    return { enabled: false };
  }

  const cliOutput = cli.githubAnnotationsOutput?.trim();
  if (cliOutput === "") {
    throw new Error("GitHub annotations output path must not be empty.");
  }

  if (cli.githubAnnotations || cliOutput) {
    return {
      enabled: true,
      ...(cliOutput ? { outputPath: cliOutput } : {}),
    };
  }

  if (config.githubAnnotations) {
    const configOutput = config.githubAnnotationsOutput?.trim();
    if (configOutput === "") {
      throw new Error("GitHub annotations output path in configuration must not be empty.");
    }
    return {
      enabled: true,
      ...(configOutput ? { outputPath: configOutput } : {}),
    };
  }

  return { enabled: false };
}

export interface GitHubStepSummaryCliOptions {
  githubStepSummary?: boolean;
  noGitHubStepSummary?: boolean;
}

export function resolveGitHubStepSummaryOptions(input: {
  config?: Pick<ResolvedReportsConfig, "githubStepSummary"> | { githubStepSummary?: boolean };
  cli?: GitHubStepSummaryCliOptions;
}): { enabled: boolean } {
  const config = input.config ?? { githubStepSummary: false };
  const cli = input.cli ?? {};

  if (cli.noGitHubStepSummary) {
    return { enabled: false };
  }
  if (cli.githubStepSummary) {
    return { enabled: true };
  }
  if (config.githubStepSummary) {
    return { enabled: true };
  }
  return { enabled: false };
}
