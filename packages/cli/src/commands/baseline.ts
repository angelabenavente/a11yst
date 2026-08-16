import { access } from "node:fs/promises";
import {
  applyBaselineUpdate,
  compareBaselineWithAudit,
  createBaselineFromAudit,
  loadBaselineFile,
  migrateBaseline,
  previewBaselineUpdate,
  readBaselineFileState,
  writeBaselineFile,
  dispositionLabel,
  type BaselineUpdatePreview,
  type CompareBaselineResult,
} from "@a11yst/baseline";
import type {
  BaselineComparisonArtifact,
  BaselineFile,
  BaselineSummary,
  AuditExecutionResult,
} from "@a11yst/types";
import { formatLabelValue } from "../output.js";
import { baselineFileExists, loadBaselineContext } from "./baseline-config.js";
import { loadAuditResults } from "./results-loader.js";

export interface RunBaselineCreateOptions {
  cwd: string;
  configPath?: string;
  from?: string;
  force?: boolean;
}

export interface BaselineCreateResult {
  status: "created";
  baselinePath: string;
  entryCount: number;
  createdAt: string;
}

export interface RunBaselineStatusOptions {
  cwd: string;
  configPath?: string;
  baselineOverride?: string;
}

export interface BaselineStatusResult {
  status: "ok";
  baselinePath: string;
  baseline: BaselineFile;
  comparison?: CompareBaselineResult;
  resultsPath?: string;
}

export interface RunBaselineUpdateOptions {
  cwd: string;
  configPath?: string;
  from?: string;
  dryRun?: boolean;
  acceptNew?: boolean;
  removeResolved?: boolean;
  yes?: boolean;
}

export interface BaselineUpdateResult {
  status: "preview" | "updated" | "unchanged";
  baselinePath: string;
  preview: BaselineUpdatePreview;
  resultsPath: string;
  comparison: CompareBaselineResult;
  updated?: BaselineFile;
}

export interface RunBaselineMigrateOptions {
  cwd: string;
  configPath?: string;
  baselineOverride?: string;
  dryRun?: boolean;
  yes?: boolean;
}

export interface BaselineMigrateResult {
  status: "preview" | "migrated" | "unchanged";
  baselinePath: string;
  migrated: boolean;
  message: string;
  baseline: BaselineFile;
}

async function ensureBaselineWritable(
  baselinePath: string,
  force: boolean | undefined,
): Promise<void> {
  if (force) return;
  try {
    await access(baselinePath);
    throw new Error(
      `Baseline file already exists at "${baselinePath}". Use --force to overwrite it.`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      throw error;
    }
  }
}

export async function runBaselineCreate(
  options: RunBaselineCreateOptions,
): Promise<BaselineCreateResult> {
  const context = await loadBaselineContext({
    cwd: options.cwd,
    configPath: options.configPath,
  });
  await ensureBaselineWritable(context.baselinePath, options.force);

  const { result, resultsPath } = await loadAuditResults({
    cwd: options.cwd,
    resultsPath: options.from,
  });

  const baseline = createBaselineFromAudit(result, { resultPath: resultsPath });
  await writeBaselineFile(context.baselinePath, baseline);

  return {
    status: "created",
    baselinePath: context.baselinePath,
    entryCount: baseline.entries.length,
    createdAt: baseline.createdAt,
  };
}

async function tryLoadComparison(options: {
  cwd: string;
  configPath?: string;
  baselineOverride?: string;
  baseline: BaselineFile;
  baselinePath: string;
  applyClassifications: boolean;
}): Promise<{ comparison: CompareBaselineResult; resultsPath: string } | undefined> {
  try {
    const loaded = await loadAuditResults({ cwd: options.cwd });
    const comparison = compareBaselineWithAudit(options.baseline, loaded.result, {
      baselinePath: options.baselinePath,
      applyClassifications: options.applyClassifications,
    });
    return { comparison, resultsPath: loaded.resultsPath };
  } catch {
    return undefined;
  }
}

export async function runBaselineStatus(
  options: RunBaselineStatusOptions,
): Promise<BaselineStatusResult> {
  const context = await loadBaselineContext({
    cwd: options.cwd,
    configPath: options.configPath,
    baselineOverride: options.baselineOverride,
  });
  const baseline = await loadBaselineFile(context.baselinePath);
  const compared = await tryLoadComparison({
    cwd: options.cwd,
    configPath: options.configPath,
    baselineOverride: options.baselineOverride,
    baseline,
    baselinePath: context.baselinePath,
    applyClassifications: context.baseline.classifications,
  });

  return {
    status: "ok",
    baselinePath: context.baselinePath,
    baseline,
    ...(compared
      ? { comparison: compared.comparison, resultsPath: compared.resultsPath }
      : {}),
  };
}

export async function runBaselineUpdate(
  options: RunBaselineUpdateOptions,
): Promise<BaselineUpdateResult> {
  const context = await loadBaselineContext({
    cwd: options.cwd,
    configPath: options.configPath,
  });
  const baseline = await loadBaselineFile(context.baselinePath);
  const fileState = await readBaselineFileState(context.baselinePath);
  const { result, resultsPath } = await loadAuditResults({
    cwd: options.cwd,
    resultsPath: options.from,
  });

  const comparison = compareBaselineWithAudit(baseline, result, {
    baselinePath: context.baselinePath,
    applyClassifications: context.baseline.classifications,
  });
  const preview = previewBaselineUpdate(baseline, comparison);

  const willWrite = Boolean(options.acceptNew || options.removeResolved);
  const dryRun = options.dryRun !== false || !willWrite;

  if (!preview.hasChanges) {
    return {
      status: "unchanged",
      baselinePath: context.baselinePath,
      preview,
      resultsPath,
      comparison,
    };
  }

  if (dryRun || !willWrite) {
    return {
      status: "preview",
      baselinePath: context.baselinePath,
      preview,
      resultsPath,
      comparison,
    };
  }

  if (!options.yes) {
    const error = new Error("Baseline update requires confirmation. Re-run with --yes to apply.");
    (error as Error & { exitCode: number; preview: BaselineUpdateResult }).exitCode = 2;
    (error as Error & { preview: BaselineUpdateResult }).preview = {
      status: "preview",
      baselinePath: context.baselinePath,
      preview,
      resultsPath,
      comparison,
    };
    throw error;
  }

  const updated = applyBaselineUpdate(baseline, comparison, {
    acceptNew: options.acceptNew,
    removeResolved: options.removeResolved,
  });

  if (!updated) {
    return {
      status: "unchanged",
      baselinePath: context.baselinePath,
      preview,
      resultsPath,
      comparison,
    };
  }

  await writeBaselineFile(context.baselinePath, updated, {
    expectedHash: fileState.hash,
    expectedMtimeMs: fileState.mtimeMs,
  });

  return {
    status: "updated",
    baselinePath: context.baselinePath,
    preview,
    resultsPath,
    comparison,
    updated,
  };
}

export async function runBaselineMigrate(
  options: RunBaselineMigrateOptions,
): Promise<BaselineMigrateResult> {
  const context = await loadBaselineContext({
    cwd: options.cwd,
    configPath: options.configPath,
    baselineOverride: options.baselineOverride,
  });
  const fileState = await readBaselineFileState(context.baselinePath);
  const migratedResult = migrateBaseline(JSON.parse(fileState.content));

  if (!migratedResult.migrated) {
    return {
      status: "unchanged",
      baselinePath: context.baselinePath,
      migrated: false,
      message: migratedResult.message,
      baseline: migratedResult.baseline,
    };
  }

  if (options.dryRun) {
    return {
      status: "preview",
      baselinePath: context.baselinePath,
      migrated: true,
      message: migratedResult.message,
      baseline: migratedResult.baseline,
    };
  }

  if (!options.yes) {
    const error = new Error("Baseline migration requires confirmation. Re-run with --yes to apply.");
    (error as Error & { exitCode: number }).exitCode = 2;
    throw error;
  }

  await writeBaselineFile(context.baselinePath, migratedResult.baseline, {
    expectedHash: fileState.hash,
    expectedMtimeMs: fileState.mtimeMs,
  });

  return {
    status: "migrated",
    baselinePath: context.baselinePath,
    migrated: true,
    message: migratedResult.message,
    baseline: migratedResult.baseline,
  };
}

function formatSummaryBlock(summary: BaselineSummary): string[] {
  return [
    formatLabelValue("NEW", String(summary.newFindings)),
    formatLabelValue("KNOWN", String(summary.knownFindings)),
    formatLabelValue("REGRESSED", String(summary.regressedFindings)),
    formatLabelValue("RESOLVED", String(summary.resolvedFindings)),
    formatLabelValue("NOT COMPARED", String(summary.notComparedFindings)),
  ];
}

function formatDispositionCounts(summary: BaselineSummary): string[] {
  const lines: string[] = ["Classifications"];
  lines.push(formatLabelValue("False positive", String(summary.dispositions.falsePositive)));
  lines.push(formatLabelValue("Accepted risk", String(summary.dispositions.acceptedRisk)));
  lines.push(formatLabelValue("Third party", String(summary.dispositions.thirdParty)));
  lines.push(formatLabelValue("Not applicable", String(summary.dispositions.notApplicable)));
  lines.push(formatLabelValue("Manual review", String(summary.dispositions.manualReview)));
  lines.push(formatLabelValue("Expired", String(summary.expiredClassifications)));
  return lines;
}

function formatPreviewHuman(preview: BaselineUpdatePreview): string[] {
  const lines = ["Proposed baseline changes", ""];
  lines.push(formatLabelValue("Add", String(preview.added.length)));
  lines.push(formatLabelValue("Remove", String(preview.removed.length)));
  lines.push(formatLabelValue("Unchanged", String(preview.unchanged.length)));
  lines.push(formatLabelValue("Regressed", String(preview.regressed.length)));
  if (preview.regressed.length > 0) {
    lines.push("");
    lines.push("Regressions are never accepted silently:");
    for (const entry of preview.regressed) {
      lines.push(`- ${entry.ruleId} (${entry.fingerprint.slice(0, 12)}…)`);
    }
  }
  return lines;
}

export function formatBaselineCreateHuman(result: BaselineCreateResult): string {
  return [
    "Baseline created",
    "",
    formatLabelValue("Path", result.baselinePath),
    formatLabelValue("Entries", String(result.entryCount)),
    formatLabelValue("Created", result.createdAt),
    "",
    "A baseline records known accessibility debt.",
    "It does not make that debt accessible or compliant.",
  ].join("\n");
}

export function formatBaselineCreateJson(result: BaselineCreateResult): unknown {
  return result;
}

export function formatBaselineStatusHuman(result: BaselineStatusResult): string {
  const lines = ["Baseline status", ""];
  lines.push(formatLabelValue("Path", result.baselinePath));
  lines.push(formatLabelValue("Schema", result.baseline.schemaVersion));
  lines.push(formatLabelValue("Fingerprint", result.baseline.fingerprintVersion));
  lines.push(formatLabelValue("Created", result.baseline.createdAt));
  lines.push(formatLabelValue("Updated", result.baseline.updatedAt));
  lines.push(formatLabelValue("Entries", String(result.baseline.entries.length)));

  const classified = result.baseline.entries.filter((entry) => entry.classification).length;
  lines.push(formatLabelValue("Classified", String(classified)));

  if (result.comparison) {
    lines.push("");
    lines.push("Compared with latest audit");
    if (result.resultsPath) {
      lines.push(formatLabelValue("Results", result.resultsPath));
    }
    lines.push("");
    lines.push(...formatSummaryBlock(result.comparison.summary));
    lines.push("");
    lines.push(...formatDispositionCounts(result.comparison.summary));
  } else {
    lines.push("");
    lines.push("No latest audit results found for comparison.");
  }

  lines.push("");
  lines.push("A baseline records known accessibility debt.");
  lines.push("It does not make that debt accessible or compliant.");
  return lines.join("\n");
}

export function formatBaselineStatusJson(result: BaselineStatusResult): unknown {
  return {
    status: result.status,
    baselinePath: result.baselinePath,
    baseline: result.baseline,
    resultsPath: result.resultsPath,
    summary: result.comparison?.summary,
    artifact: result.comparison?.artifact,
  };
}

export function formatBaselineUpdateHuman(result: BaselineUpdateResult): string {
  const lines =
    result.status === "updated"
      ? ["Baseline updated", ""]
      : result.status === "unchanged"
        ? ["Baseline unchanged", ""]
        : ["Baseline update preview", ""];

  lines.push(formatLabelValue("Path", result.baselinePath));
  lines.push(formatLabelValue("Results", result.resultsPath));
  lines.push("");
  lines.push(...formatPreviewHuman(result.preview));

  if (result.status === "preview") {
    lines.push("");
    lines.push("No changes were written.");
    lines.push("Use --accept-new and/or --remove-resolved with --yes to apply.");
  }

  if (result.comparison.summary.baselineUsed) {
    lines.push("");
    lines.push(...formatSummaryBlock(result.comparison.summary));
  }

  return lines.join("\n");
}

export function formatBaselineUpdateJson(result: BaselineUpdateResult): unknown {
  return {
    status: result.status,
    baselinePath: result.baselinePath,
    resultsPath: result.resultsPath,
    preview: result.preview,
    summary: result.comparison.summary,
    updated: result.updated,
  };
}

export function formatBaselineMigrateHuman(result: BaselineMigrateResult): string {
  const lines =
    result.status === "migrated"
      ? ["Baseline migrated", ""]
      : result.status === "preview"
        ? ["Baseline migration preview", ""]
        : ["Baseline migration", ""];

  lines.push(formatLabelValue("Path", result.baselinePath));
  lines.push(formatLabelValue("Migrated", result.migrated ? "yes" : "no"));
  lines.push(formatLabelValue("Message", result.message));

  if (result.status === "preview") {
    lines.push("");
    lines.push("No changes were written. Re-run without --dry-run and with --yes to apply.");
  }

  return lines.join("\n");
}

export function formatBaselineMigrateJson(result: BaselineMigrateResult): unknown {
  return {
    status: result.status,
    baselinePath: result.baselinePath,
    migrated: result.migrated,
    message: result.message,
    baseline: result.baseline,
  };
}

export function formatBaselineComparisonArtifact(summary: BaselineSummary): string[] {
  if (!summary.baselineUsed) {
    return [];
  }
  return ["", "Baseline comparison", "", ...formatSummaryBlock(summary), ""];
}

export { dispositionLabel, type BaselineComparisonArtifact };

export async function applyBaselineToAuditResult(options: {
  cwd: string;
  configPath?: string;
  result: AuditExecutionResult;
  noBaseline?: boolean;
  baselineOverride?: string;
  explicitBaselineRequired?: boolean;
}): Promise<AuditExecutionResult> {
  if (options.noBaseline) {
    return options.result;
  }

  const context = await loadBaselineContext({
    cwd: options.cwd,
    configPath: options.configPath,
    baselineOverride: options.baselineOverride,
  });

  const exists = await baselineFileExists(context.baselinePath);
  if (!exists) {
    if (options.explicitBaselineRequired || options.baselineOverride) {
      throw new Error(`Baseline file not found: ${context.baselinePath}`);
    }
    if (!context.baseline.compare) {
      return options.result;
    }
    return options.result;
  }

  const baseline = await loadBaselineFile(context.baselinePath);
  const comparison = compareBaselineWithAudit(baseline, options.result, {
    baselinePath: context.baselinePath,
    applyClassifications: context.baseline.classifications,
  });

  return {
    ...options.result,
    findings: comparison.findings,
    baselineSummary: comparison.summary,
    resolvedFindings: comparison.resolvedFindings,
    notComparedFindings: comparison.notComparedFindings,
  };
}

export async function createBaselineAfterAudit(options: {
  cwd: string;
  configPath?: string;
  result: AuditExecutionResult;
  force?: boolean;
}): Promise<BaselineCreateResult> {
  const context = await loadBaselineContext({
    cwd: options.cwd,
    configPath: options.configPath,
  });
  await ensureBaselineWritable(context.baselinePath, options.force);
  const baseline = createBaselineFromAudit(options.result, {
    resultPath: options.result.artifacts?.resultsPath,
  });
  await writeBaselineFile(context.baselinePath, baseline);
  return {
    status: "created",
    baselinePath: context.baselinePath,
    entryCount: baseline.entries.length,
    createdAt: baseline.createdAt,
  };
}
