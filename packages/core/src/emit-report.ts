import { lstat, mkdir } from "node:fs/promises";
import { generateHtmlReport } from "@a11yst/reporters";
import type {
  AuditExecutionResult,
  ResolvedCiPolicyConfig,
} from "@a11yst/types";
import {
  generateGitHubAnnotationsReport,
  type GenerateGitHubAnnotationsReportOutput,
} from "./generate-github-annotations-report.js";
import {
  generateJunitReport,
  type GenerateJunitReportOutput,
} from "./generate-junit-report.js";
import {
  generateMarkdownReportArtifact,
  type GenerateMarkdownReportOutput,
} from "./generate-markdown-report.js";
import {
  generateSarifReport,
  type GenerateSarifReportOutput,
} from "./generate-sarif-report.js";

export type EmittableReportFormat =
  | "html"
  | "sarif"
  | "junit"
  | "markdown"
  | "github-annotations";

export interface EmitReportArtifactOptions {
  format: EmittableReportFormat;
  result: AuditExecutionResult;
  bundleDirectory: string;
  bundleRelativePath?: string;
  externalOutputPath?: string;
  auditId?: string;
  policy?: ResolvedCiPolicyConfig;
  artifactReportPaths?: {
    html?: string;
    sarif?: string;
    junit?: string;
  };
}

export interface EmitHtmlReportOutput {
  format: "html";
  bundlePath: string;
  assets: string[];
}

export type EmitSarifReportOutput = GenerateSarifReportOutput & {
  format: "sarif";
};

export type EmitJunitReportOutput = GenerateJunitReportOutput & {
  format: "junit";
};

export type EmitMarkdownReportOutput = GenerateMarkdownReportOutput & {
  format: "markdown";
};

export type EmitGitHubAnnotationsReportOutput =
  GenerateGitHubAnnotationsReportOutput & {
    format: "github-annotations";
  };

export type EmitReportArtifactOutput =
  | EmitHtmlReportOutput
  | EmitSarifReportOutput
  | EmitJunitReportOutput
  | EmitMarkdownReportOutput
  | EmitGitHubAnnotationsReportOutput;

async function ensureReportDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  const status = await lstat(path);
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error(`Report output directory is not a safe directory: ${path}`);
  }
}

/**
 * Canonical report emission boundary used by live audits and offline
 * regeneration. Callers retain responsibility for deciding which formats are
 * enabled and how a failed emission affects the surrounding operation.
 */
export function emitReportArtifact(
  options: EmitReportArtifactOptions & { format: "html" },
): Promise<EmitHtmlReportOutput>;
export function emitReportArtifact(
  options: EmitReportArtifactOptions & { format: "sarif" },
): Promise<EmitSarifReportOutput>;
export function emitReportArtifact(
  options: EmitReportArtifactOptions & { format: "junit" },
): Promise<EmitJunitReportOutput>;
export function emitReportArtifact(
  options: EmitReportArtifactOptions & { format: "markdown" },
): Promise<EmitMarkdownReportOutput>;
export function emitReportArtifact(
  options: EmitReportArtifactOptions & { format: "github-annotations" },
): Promise<EmitGitHubAnnotationsReportOutput>;
export async function emitReportArtifact(
  options: EmitReportArtifactOptions,
): Promise<EmitReportArtifactOutput> {
  await ensureReportDirectory(options.bundleDirectory);
  switch (options.format) {
    case "html": {
      const generated = await generateHtmlReport({
        auditResult: options.result,
        outputDirectory: options.bundleDirectory,
        auditId: options.auditId,
      });
      return {
        format: "html",
        bundlePath: generated.indexPath,
        assets: generated.assets,
      };
    }
    case "sarif": {
      const generated = await generateSarifReport({
        result: options.result,
        bundleDirectory: options.bundleDirectory,
        ...(options.bundleRelativePath
          ? { bundleRelativePath: options.bundleRelativePath }
          : {}),
        ...(options.externalOutputPath
          ? { externalOutputPath: options.externalOutputPath }
          : {}),
      });
      return { format: "sarif", ...generated };
    }
    case "junit": {
      const generated = await generateJunitReport({
        result: options.result,
        bundleDirectory: options.bundleDirectory,
        ...(options.bundleRelativePath
          ? { bundleRelativePath: options.bundleRelativePath }
          : {}),
        ...(options.externalOutputPath
          ? { externalOutputPath: options.externalOutputPath }
          : {}),
        ...(options.policy ? { policy: options.policy } : {}),
      });
      return { format: "junit", ...generated };
    }
    case "markdown": {
      const generated = await generateMarkdownReportArtifact({
        result: options.result,
        bundleDirectory: options.bundleDirectory,
        ...(options.bundleRelativePath
          ? { bundleRelativePath: options.bundleRelativePath }
          : {}),
        ...(options.externalOutputPath
          ? { externalOutputPath: options.externalOutputPath }
          : {}),
        ...(options.policy ? { policy: options.policy } : {}),
        ...(options.artifactReportPaths
          ? { artifactReportPaths: options.artifactReportPaths }
          : {}),
      });
      return { format: "markdown", ...generated };
    }
    case "github-annotations": {
      const generated = await generateGitHubAnnotationsReport({
        result: options.result,
        bundleDirectory: options.bundleDirectory,
        ...(options.bundleRelativePath
          ? { bundleRelativePath: options.bundleRelativePath }
          : {}),
        ...(options.externalOutputPath
          ? { externalOutputPath: options.externalOutputPath }
          : {}),
        ...(options.policy ? { policy: options.policy } : {}),
      });
      return { format: "github-annotations", ...generated };
    }
  }
}
