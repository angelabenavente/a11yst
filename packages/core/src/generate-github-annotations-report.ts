import {
  writeExternalGitHubAnnotationsArtifact,
  writeGitHubAnnotationsArtifact,
} from "@a11yst/artifacts";
import { generateGitHubAnnotations } from "@a11yst/reporters";
import type {
  AuditExecutionResult,
  GitHubAnnotationsReportManifestEntry,
  GitHubAnnotationsReportResultReference,
  ResolvedCiPolicyConfig,
} from "@a11yst/types";
import { DEFAULT_GITHUB_ANNOTATIONS_BUNDLE_PATH } from "@a11yst/types";
import { createGitHubAnnotationsInputFromAuditResult } from "./create-github-annotations-input.js";

export interface GenerateGitHubAnnotationsReportOptions {
  result: AuditExecutionResult;
  bundleDirectory: string;
  bundleRelativePath?: string;
  externalOutputPath?: string;
  policy?: ResolvedCiPolicyConfig;
}

export interface GenerateGitHubAnnotationsReportOutput {
  serialized: string;
  bundlePath: string;
  externalPath?: string;
  manifestEntry: GitHubAnnotationsReportManifestEntry;
  resultReference: GitHubAnnotationsReportResultReference;
}

export function shouldGenerateGitHubAnnotationsForAuditResult(
  result: AuditExecutionResult,
): boolean {
  return result.status !== "failed";
}

export async function generateGitHubAnnotationsReport(
  options: GenerateGitHubAnnotationsReportOptions,
): Promise<GenerateGitHubAnnotationsReportOutput> {
  const bundleRelativePath =
    options.bundleRelativePath ?? DEFAULT_GITHUB_ANNOTATIONS_BUNDLE_PATH;
  const input = createGitHubAnnotationsInputFromAuditResult(options.result, options.policy);
  const generation = generateGitHubAnnotations(input);
  const serialized = generation.commands;
  const bundlePath = await writeGitHubAnnotationsArtifact({
    bundleDirectory: options.bundleDirectory,
    relativePath: bundleRelativePath,
    serializedCommands: serialized,
  });

  let externalPath: string | undefined;
  if (options.externalOutputPath) {
    externalPath = await writeExternalGitHubAnnotationsArtifact({
      targetPath: options.externalOutputPath,
      serializedCommands: serialized,
    });
  }

  const manifestEntry: GitHubAnnotationsReportManifestEntry = {
    path: bundlePath,
    annotations: generation.summary.annotations,
    errors: generation.summary.errors,
    warnings: generation.summary.warnings,
    notices: generation.summary.notices,
    truncated: generation.summary.truncated,
  };

  const resultReference: GitHubAnnotationsReportResultReference = {
    path: bundlePath,
    summary: {
      annotations: generation.summary.annotations,
      errors: generation.summary.errors,
      warnings: generation.summary.warnings,
      notices: generation.summary.notices,
      truncated: generation.summary.truncated,
    },
  };

  return {
    serialized,
    bundlePath,
    externalPath,
    manifestEntry,
    resultReference,
  };
}
