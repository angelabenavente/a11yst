import {
  loadBaselineFile,
  readBaselineFileState,
  removeClassificationFromEntry,
  resolveFindingIdentifier,
  writeBaselineFile,
} from "@a11yst/baseline";
import type { FindingClassification } from "@a11yst/types";
import { formatLabelValue } from "../output.js";
import { loadBaselineContext } from "./baseline-config.js";
import { loadAuditResults } from "./results-loader.js";

export interface RunUnclassifyOptions {
  cwd: string;
  configPath?: string;
  findingId: string;
  from?: string;
  yes?: boolean;
}

export interface UnclassifyResult {
  status: "preview" | "removed";
  baselinePath: string;
  findingId: string;
  fingerprint: string;
  previousClassification?: FindingClassification;
}

export async function runUnclassify(options: RunUnclassifyOptions): Promise<UnclassifyResult> {
  const context = await loadBaselineContext({
    cwd: options.cwd,
    configPath: options.configPath,
  });
  const { result } = await loadAuditResults({
    cwd: options.cwd,
    resultsPath: options.from,
  });
  const match = resolveFindingIdentifier(result, options.findingId);
  const finding = match.finding;

  const baseline = await loadBaselineFile(context.baselinePath);
  const entry = baseline.entries.find((item) => item.fingerprint === finding.fingerprint);
  if (!entry) {
    throw new Error(
      `Finding "${finding.id}" is not present in the baseline at "${context.baselinePath}".`,
    );
  }
  if (!entry.classification) {
    throw new Error(`Finding "${finding.id}" has no classification to remove.`);
  }

  const preview: UnclassifyResult = {
    status: "preview",
    baselinePath: context.baselinePath,
    findingId: finding.id,
    fingerprint: finding.fingerprint,
    previousClassification: entry.classification,
  };

  if (!options.yes) {
    const error = new Error("Unclassify requires confirmation. Re-run with --yes to apply.");
    (error as Error & { exitCode: number; preview: UnclassifyResult }).exitCode = 2;
    (error as Error & { preview: UnclassifyResult }).preview = preview;
    throw error;
  }

  const now = new Date().toISOString();
  const updatedEntry = removeClassificationFromEntry(entry, now);
  const fileState = await readBaselineFileState(context.baselinePath);

  await writeBaselineFile(
    context.baselinePath,
    {
      ...baseline,
      updatedAt: now,
      entries: baseline.entries.map((item) =>
        item.fingerprint === finding.fingerprint ? updatedEntry : item,
      ),
    },
    {
      expectedHash: fileState.hash,
      expectedMtimeMs: fileState.mtimeMs,
    },
  );

  return {
    status: "removed",
    baselinePath: context.baselinePath,
    findingId: finding.id,
    fingerprint: finding.fingerprint,
    previousClassification: entry.classification,
  };
}

export function formatUnclassifyHuman(result: UnclassifyResult): string {
  const lines =
    result.status === "removed"
      ? ["Classification removed", ""]
      : ["Unclassify preview", ""];

  lines.push(formatLabelValue("Baseline", result.baselinePath));
  lines.push(formatLabelValue("Finding", result.findingId));
  lines.push(formatLabelValue("Fingerprint", result.fingerprint));
  if (result.previousClassification) {
    lines.push(formatLabelValue("Disposition", result.previousClassification.disposition));
    lines.push(formatLabelValue("Reason", result.previousClassification.reason));
  }

  if (result.status === "preview") {
    lines.push("");
    lines.push("No changes were written. Re-run with --yes to apply.");
  }

  return lines.join("\n");
}

export function formatUnclassifyJson(result: UnclassifyResult): unknown {
  return result;
}

export function formatUnclassifyPreviewFromError(
  error: Error & { preview?: UnclassifyResult },
): UnclassifyResult | undefined {
  return error.preview;
}
