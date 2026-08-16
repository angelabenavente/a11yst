import {
  applyClassificationToEntry,
  entryFromFinding,
  loadBaselineFile,
  readBaselineFileState,
  rejectResolvedDisposition,
  resolveFindingIdentifier,
  validateClassification,
  writeBaselineFile,
  dispositionLabel,
} from "@a11yst/baseline";
import type { FindingClassification, FindingDisposition } from "@a11yst/types";
import { formatLabelValue } from "../output.js";
import { loadBaselineContext } from "./baseline-config.js";
import { loadAuditResults } from "./results-loader.js";

export interface RunClassifyOptions {
  cwd: string;
  configPath?: string;
  findingId: string;
  from?: string;
  disposition: FindingDisposition;
  reason: string;
  owner?: string;
  ticket?: string;
  expires?: string;
  review?: string;
  notes?: string;
  yes?: boolean;
}

export interface ClassifyResult {
  status: "preview" | "classified";
  baselinePath: string;
  findingId: string;
  fingerprint: string;
  disposition: FindingDisposition;
  classification: FindingClassification;
}

export async function runClassify(options: RunClassifyOptions): Promise<ClassifyResult> {
  rejectResolvedDisposition(options.disposition);

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

  const classification: FindingClassification = {
    disposition: options.disposition,
    reason: options.reason,
    createdAt: new Date().toISOString(),
    scope: {
      type: "finding",
      fingerprint: finding.fingerprint,
    },
    ...(options.owner ? { owner: options.owner } : {}),
    ...(options.ticket ? { ticket: options.ticket } : {}),
    ...(options.expires ? { expiresAt: options.expires } : {}),
    ...(options.review ? { reviewAt: options.review } : {}),
    ...(options.notes ? { notes: options.notes } : {}),
  };

  validateClassification(classification);

  const baseline = await loadBaselineFile(context.baselinePath);
  const existing = baseline.entries.find((entry) => entry.fingerprint === finding.fingerprint);
  const now = new Date().toISOString();
  const entry =
    existing ??
    entryFromFinding(
      finding,
      result.runs.find((run) => run.findings.some((item) => item.fingerprint === finding.fingerprint)),
      now,
    );

  const updatedEntry = applyClassificationToEntry(entry, classification, now, Boolean(existing?.classification));

  if (!options.yes) {
    const error = new Error("Classification requires confirmation. Re-run with --yes to apply.");
    (error as Error & { exitCode: number; preview: ClassifyResult }).exitCode = 2;
    (error as Error & { preview: ClassifyResult }).preview = {
      status: "preview",
      baselinePath: context.baselinePath,
      findingId: finding.id,
      fingerprint: finding.fingerprint,
      disposition: options.disposition,
      classification,
    };
    throw error;
  }

  const fileState = await readBaselineFileState(context.baselinePath);
  const nextEntries = existing
    ? baseline.entries.map((item) =>
        item.fingerprint === finding.fingerprint ? updatedEntry : item,
      )
    : [...baseline.entries, updatedEntry];

  await writeBaselineFile(
    context.baselinePath,
    {
      ...baseline,
      updatedAt: now,
      entries: nextEntries,
    },
    {
      expectedHash: fileState.hash,
      expectedMtimeMs: fileState.mtimeMs,
    },
  );

  return {
    status: "classified",
    baselinePath: context.baselinePath,
    findingId: finding.id,
    fingerprint: finding.fingerprint,
    disposition: options.disposition,
    classification,
  };
}

export function formatClassifyHuman(result: ClassifyResult): string {
  const lines =
    result.status === "classified"
      ? ["Classification saved", ""]
      : ["Classification preview", ""];

  lines.push(formatLabelValue("Baseline", result.baselinePath));
  lines.push(formatLabelValue("Finding", result.findingId));
  lines.push(formatLabelValue("Fingerprint", result.fingerprint));
  lines.push(formatLabelValue("Disposition", dispositionLabel(result.disposition)));
  lines.push(formatLabelValue("Reason", result.classification.reason));
  if (result.classification.owner) {
    lines.push(formatLabelValue("Owner", result.classification.owner));
  }
  if (result.classification.ticket) {
    lines.push(formatLabelValue("Ticket", result.classification.ticket));
  }
  if (result.classification.expiresAt) {
    lines.push(formatLabelValue("Expires", result.classification.expiresAt));
  }
  if (result.classification.reviewAt) {
    lines.push(formatLabelValue("Review", result.classification.reviewAt));
  }
  if (result.status === "preview") {
    lines.push("");
    lines.push("No changes were written. Re-run with --yes to apply.");
  }
  return lines.join("\n");
}

export function formatClassifyJson(result: ClassifyResult): unknown {
  return result;
}

export function formatClassifyPreviewFromError(error: Error & { preview?: ClassifyResult }): ClassifyResult | undefined {
  return error.preview;
}
