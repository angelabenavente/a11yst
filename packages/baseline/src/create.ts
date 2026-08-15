import type {
  AuditExecutionResult,
  AuditRunResult,
  BaselineEntry,
  BaselineEntrySnapshot,
  BaselineFile,
  BaselineHistoryEntry,
  BaselineSourceCoverage,
  Finding,
  FindingClassification,
} from "@a11yst/types";
import {
  CURRENT_BASELINE_SCHEMA_VERSION,
  CURRENT_FINGERPRINT_VERSION,
  productMetadata,
} from "@a11yst/types";
import { findingLocation, fingerprintVersionOf } from "./location.js";
import { BaselineValidationError } from "./schema.js";

const MAX_HISTORY_ENTRIES = 20;

export function buildCoverageFromAudit(result: AuditExecutionResult): BaselineSourceCoverage {
  const projects = new Set<string>();
  const profiles = new Set<string>();
  const viewports = new Set<string>();
  let routeRuns = 0;
  let flowCheckpointRuns = 0;
  let skippedRuns = 0;

  for (const run of result.runs) {
    projects.add(run.projectName);
    profiles.add(run.profile);
    if (run.viewport?.name) {
      viewports.add(run.viewport.name);
    }
    if (run.status === "skipped") {
      skippedRuns += 1;
      continue;
    }
    if (run.kind === "flow-checkpoint" || run.flowId) {
      flowCheckpointRuns += 1;
    } else {
      routeRuns += 1;
    }
  }

  return {
    projects: [...projects].sort(),
    profiles: [...profiles].sort(),
    viewports: [...viewports].sort(),
    routeRuns,
    flowCheckpointRuns,
    skippedRuns,
  };
}

function snapshotFromFinding(
  finding: Finding,
  run?: AuditRunResult,
): BaselineEntrySnapshot {
  return {
    title: finding.title,
    target: finding.target.length > 0 ? [...finding.target] : undefined,
    route: finding.route,
    routeId: finding.routeId,
    flowId: finding.flowId,
    checkpointId: finding.checkpointId,
    profile: finding.profile,
    viewport: finding.viewport,
    adapterId: run?.adapter?.adapterId,
    framework: run?.framework,
    confidence: finding.confidence,
  };
}

export function entryFromFinding(
  finding: Finding,
  run: AuditRunResult | undefined,
  at: string,
): BaselineEntry {
  const history: BaselineHistoryEntry[] = [{ at, action: "created" }];
  return {
    fingerprint: finding.fingerprint,
    fingerprintVersion: fingerprintVersionOf(finding),
    ruleId: finding.ruleId,
    source: finding.source,
    projectName: finding.projectName,
    location: findingLocation(finding),
    severity: finding.severity,
    ...(finding.sourceImpact !== undefined ? { sourceImpact: finding.sourceImpact } : {}),
    firstSeenAt: at,
    lastSeenAt: at,
    snapshot: snapshotFromFinding(finding, run),
    history,
  };
}

export function createBaselineFromAudit(
  result: AuditExecutionResult,
  options: {
    now?: string;
    resultPath?: string;
  } = {},
): BaselineFile {
  const now = options.now ?? new Date().toISOString();
  const successfulRuns = result.runs.filter((run) => run.status === "completed");
  if (successfulRuns.length === 0) {
    throw new BaselineValidationError(
      "Cannot create a baseline when all runs were skipped or failed.",
    );
  }

  const runByFinding = new Map<string, AuditRunResult>();
  for (const run of successfulRuns) {
    for (const finding of run.findings) {
      runByFinding.set(finding.fingerprint, run);
    }
  }

  const entries = sortEntries(
    sortFindingsForBaseline(result.findings).map((finding) =>
      entryFromFinding(finding, runByFinding.get(finding.fingerprint), now),
    ),
  );

  return {
    schemaVersion: CURRENT_BASELINE_SCHEMA_VERSION,
    fingerprintVersion: CURRENT_FINGERPRINT_VERSION,
    createdAt: now,
    updatedAt: now,
    productVersion: productMetadata.version,
    sourceAudit: {
      auditId: result.auditId,
      resultPath: options.resultPath,
      coverage: buildCoverageFromAudit(result),
    },
    entries,
  };
}

function sortFindingsForBaseline(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}

export function sortEntries(entries: BaselineEntry[]): BaselineEntry[] {
  return [...entries].sort((a, b) => {
    const byFingerprint = a.fingerprint.localeCompare(b.fingerprint);
    if (byFingerprint !== 0) return byFingerprint;
    return a.projectName.localeCompare(b.projectName);
  });
}

export function appendHistory(
  entry: BaselineEntry,
  action: BaselineHistoryEntry["action"],
  at: string,
  details?: Record<string, string>,
): BaselineHistoryEntry[] {
  const next = [...(entry.history ?? []), { at, action, ...(details ? { details } : {}) }];
  if (next.length > MAX_HISTORY_ENTRIES) {
    return next.slice(next.length - MAX_HISTORY_ENTRIES);
  }
  return next;
}

export function applyClassificationToEntry(
  entry: BaselineEntry,
  classification: FindingClassification,
  at: string,
  updated = false,
): BaselineEntry {
  return {
    ...entry,
    classification,
    history: appendHistory(
      entry,
      updated ? "classification-updated" : "classification-added",
      at,
      { disposition: classification.disposition },
    ),
  };
}

export function removeClassificationFromEntry(entry: BaselineEntry, at: string): BaselineEntry {
  const { classification: _removed, ...rest } = entry;
  return {
    ...rest,
    history: appendHistory(entry, "classification-removed", at),
  };
}
