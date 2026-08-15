import { access } from "node:fs/promises";
import {
  compareBaselineWithAudit,
  loadBaselineFile,
  resolveBaselinePath,
  type CompareBaselineResult,
} from "@a11yst/baseline";
import type {
  AuditExecutionResult,
  BaselineComparisonArtifact,
  ResolvedConfig,
} from "@a11yst/types";

export interface ApplyBaselineComparisonOptions {
  noBaseline?: boolean;
  /** Absolute or config-relative baseline path override. */
  baselinePath?: string;
  /** Fail when the configured baseline path does not exist. */
  explicitBaselineRequired?: boolean;
}

export interface ApplyBaselineComparisonOutput {
  result: AuditExecutionResult;
  comparison?: CompareBaselineResult;
  artifact?: BaselineComparisonArtifact;
}

export async function applyBaselineComparison(
  config: ResolvedConfig,
  result: AuditExecutionResult,
  options: ApplyBaselineComparisonOptions = {},
): Promise<ApplyBaselineComparisonOutput> {
  if (options.noBaseline) {
    return { result };
  }

  const relativePath =
    typeof options.baselinePath === "string"
      ? options.baselinePath
      : config.baseline.file;
  const resolvedPath =
    relativePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(relativePath)
      ? relativePath
      : resolveBaselinePath(config.configDir, relativePath);

  let exists = false;
  try {
    await access(resolvedPath);
    exists = true;
  } catch {
    exists = false;
  }

  if (!exists) {
    if (options.explicitBaselineRequired || options.baselinePath) {
      throw new Error(`Baseline file not found: ${resolvedPath}`);
    }
    if (!config.baseline.compare) {
      return { result };
    }
    return { result };
  }

  const baseline = await loadBaselineFile(resolvedPath);
  const comparison = compareBaselineWithAudit(baseline, result, {
    baselinePath: relativePath,
    applyClassifications: config.baseline.classifications,
  });

  return {
    result: {
      ...result,
      findings: comparison.findings,
      baselineSummary: comparison.summary,
      resolvedFindings: comparison.resolvedFindings,
      notComparedFindings: comparison.notComparedFindings,
    },
    comparison,
    artifact: comparison.artifact,
  };
}
