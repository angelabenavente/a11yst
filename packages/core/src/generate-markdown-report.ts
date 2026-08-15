import {
  writeExternalMarkdownArtifact,
  writeMarkdownArtifact,
} from "@a11yst/artifacts";
import { generateMarkdownReport } from "@a11yst/reporters";
import type {
  AuditExecutionResult,
  MarkdownReportManifestEntry,
  MarkdownReportResultReference,
  ResolvedCiPolicyConfig,
} from "@a11yst/types";
import { DEFAULT_MARKDOWN_BUNDLE_PATH } from "@a11yst/types";
import { createMarkdownInputFromAuditResult } from "./create-markdown-input.js";

export interface GenerateMarkdownReportOptions {
  result: AuditExecutionResult;
  bundleDirectory: string;
  bundleRelativePath?: string;
  externalOutputPath?: string;
  policy?: ResolvedCiPolicyConfig;
  artifactReportPaths?: {
    html?: string;
    sarif?: string;
    junit?: string;
  };
}

export interface GenerateMarkdownReportOutput {
  serialized: string;
  bundlePath: string;
  externalPath?: string;
  manifestEntry: MarkdownReportManifestEntry;
  resultReference: MarkdownReportResultReference;
}

export function shouldGenerateMarkdownForAuditResult(_result: AuditExecutionResult): boolean {
  return true;
}

export async function generateMarkdownReportArtifact(
  options: GenerateMarkdownReportOptions,
): Promise<GenerateMarkdownReportOutput> {
  const bundleRelativePath = options.bundleRelativePath ?? DEFAULT_MARKDOWN_BUNDLE_PATH;
  const reportPaths = {
    ...(options.artifactReportPaths?.html
      ? { html: { path: options.artifactReportPaths.html } }
      : {}),
    ...(options.artifactReportPaths?.sarif
      ? { sarif: { path: options.artifactReportPaths.sarif } }
      : {}),
    ...(options.artifactReportPaths?.junit
      ? { junit: { path: options.artifactReportPaths.junit } }
      : {}),
    markdown: { path: bundleRelativePath },
  };
  const input = createMarkdownInputFromAuditResult(
    options.result,
    options.policy,
    reportPaths,
  );
  const generation = generateMarkdownReport(input);
  const serialized = generation.markdown;
  const bundlePath = await writeMarkdownArtifact({
    bundleDirectory: options.bundleDirectory,
    relativePath: bundleRelativePath,
    serializedMarkdown: serialized,
  });

  let externalPath: string | undefined;
  if (options.externalOutputPath) {
    externalPath = await writeExternalMarkdownArtifact({
      targetPath: options.externalOutputPath,
      serializedMarkdown: serialized,
    });
  }

  const manifestEntry: MarkdownReportManifestEntry = {
    path: bundlePath,
    findings: generation.summary.findings,
    policyBreaches: generation.summary.policyBreaches,
    truncatedFindings: generation.summary.truncatedFindings,
  };

  const resultReference: MarkdownReportResultReference = {
    path: bundlePath,
    summary: {
      findings: generation.summary.findings,
      policyBreaches: generation.summary.policyBreaches,
      truncatedFindings: generation.summary.truncatedFindings,
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

export function generateMarkdownContentFromAuditResult(
  result: AuditExecutionResult,
  policy?: ResolvedCiPolicyConfig,
): string {
  return generateMarkdownReport(createMarkdownInputFromAuditResult(result, policy)).markdown;
}
