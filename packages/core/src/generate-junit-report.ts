import {
  writeExternalJunitArtifact,
  writeJunitArtifact,
} from "@a11yst/artifacts";
import { generateJunit, serializeJunit } from "@a11yst/junit";
import type {
  AuditExecutionResult,
  JunitReportManifestEntry,
  JunitReportResultReference,
  ResolvedCiPolicyConfig,
} from "@a11yst/types";
import { DEFAULT_JUNIT_BUNDLE_PATH } from "@a11yst/types";
import { createJunitInputFromAuditResult } from "./create-junit-input.js";

export interface GenerateJunitReportOptions {
  result: AuditExecutionResult;
  bundleDirectory: string;
  bundleRelativePath?: string;
  externalOutputPath?: string;
  policy?: ResolvedCiPolicyConfig;
}

export interface GenerateJunitReportOutput {
  serialized: string;
  bundlePath: string;
  externalPath?: string;
  manifestEntry: JunitReportManifestEntry;
  resultReference: JunitReportResultReference;
}

export function shouldGenerateJunitForAuditResult(result: AuditExecutionResult): boolean {
  return result.status !== "failed";
}

export async function generateJunitReport(
  options: GenerateJunitReportOptions,
): Promise<GenerateJunitReportOutput> {
  const bundleRelativePath = options.bundleRelativePath ?? DEFAULT_JUNIT_BUNDLE_PATH;
  const input = createJunitInputFromAuditResult(options.result, options.policy);
  const generation = generateJunit(input);
  const serialized = serializeJunit(generation.document);
  const bundlePath = await writeJunitArtifact({
    bundleDirectory: options.bundleDirectory,
    relativePath: bundleRelativePath,
    serializedJunit: serialized,
  });

  let externalPath: string | undefined;
  if (options.externalOutputPath) {
    externalPath = await writeExternalJunitArtifact({
      targetPath: options.externalOutputPath,
      serializedJunit: serialized,
    });
  }

  const manifestEntry: JunitReportManifestEntry = {
    path: bundlePath,
    tests: generation.summary.tests,
    failures: generation.summary.failures,
    errors: generation.summary.errors,
    skipped: generation.summary.skipped,
    timeSeconds: generation.summary.timeSeconds,
  };

  const resultReference: JunitReportResultReference = {
    path: bundlePath,
    summary: {
      tests: generation.summary.tests,
      failures: generation.summary.failures,
      errors: generation.summary.errors,
      skipped: generation.summary.skipped,
      timeSeconds: generation.summary.timeSeconds,
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
