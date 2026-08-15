import {
  writeExternalSarifArtifact,
  writeSarifArtifact,
} from "@a11yst/artifacts";
import { generateSarif, serializeSarif } from "@a11yst/sarif";
import type {
  AuditExecutionResult,
  SarifReportManifestEntry,
  SarifReportResultReference,
} from "@a11yst/types";
import { DEFAULT_SARIF_BUNDLE_PATH } from "@a11yst/types";
import { createSarifInputFromAuditResult } from "./create-sarif-input.js";

export interface GenerateSarifReportOptions {
  result: AuditExecutionResult;
  bundleDirectory: string;
  bundleRelativePath?: string;
  externalOutputPath?: string;
  includeResolvedSummary?: boolean;
}

export interface GenerateSarifReportOutput {
  serialized: string;
  bundlePath: string;
  externalPath?: string;
  manifestEntry: SarifReportManifestEntry;
  resultReference: SarifReportResultReference;
}

export function shouldGenerateSarifForAuditResult(result: AuditExecutionResult): boolean {
  return result.status !== "failed";
}

export async function generateSarifReport(
  options: GenerateSarifReportOptions,
): Promise<GenerateSarifReportOutput> {
  const bundleRelativePath = options.bundleRelativePath ?? DEFAULT_SARIF_BUNDLE_PATH;
  const input = createSarifInputFromAuditResult(options.result);
  const generation = generateSarif(input, {
    includeResolvedSummary: options.includeResolvedSummary ?? true,
  });
  const serialized = serializeSarif(generation.log);
  const bundlePath = await writeSarifArtifact({
    bundleDirectory: options.bundleDirectory,
    relativePath: bundleRelativePath,
    serializedSarif: serialized,
  });

  let externalPath: string | undefined;
  if (options.externalOutputPath) {
    externalPath = await writeExternalSarifArtifact({
      targetPath: options.externalOutputPath,
      serializedSarif: serialized,
    });
  }

  const manifestEntry: SarifReportManifestEntry = {
    path: bundlePath,
    version: "2.1.0",
    rules: generation.summary.rules,
    results: generation.summary.results,
    locatedResults: generation.summary.locatedResults,
    unlocatedResults: generation.summary.unlocatedResults,
  };

  const resultReference: SarifReportResultReference = {
    path: bundlePath,
    version: "2.1.0",
    summary: {
      rules: generation.summary.rules,
      results: generation.summary.results,
      locatedResults: generation.summary.locatedResults,
      unlocatedResults: generation.summary.unlocatedResults,
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
