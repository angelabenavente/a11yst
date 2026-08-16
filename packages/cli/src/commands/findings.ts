import {
  compareBaselineWithAudit,
  loadBaselineFile,
  shortFingerprint,
} from "@a11yst/baseline";
import type {
  AuditExecutionResult,
  Finding,
  FindingDisposition,
  ResolvedFinding,
} from "@a11yst/types";
import { formatLabelValue } from "../output.js";
import { baselineFileExists, loadBaselineContext } from "./baseline-config.js";
import { loadAuditResults } from "./results-loader.js";

export interface FindingsFilters {
  status?: string[];
  disposition?: string[];
  project?: string[];
  rule?: string[];
  profile?: string[];
  flow?: string[];
  checkpoint?: string[];
}

export interface FindingsEntry {
  id: string;
  fingerprint: string;
  shortFingerprint: string;
  ruleId: string;
  severity: string;
  lifecycleStatus: string;
  disposition?: string;
  projectName: string;
  location: string;
  profile: string;
  viewport?: string;
  owner?: string;
  ticket?: string;
  expiry?: string;
  reviewAt?: string;
}

export interface FindingsResult {
  resultsPath: string;
  baselinePath?: string;
  baselineUsed: boolean;
  entries: FindingsEntry[];
}

export interface RunFindingsOptions {
  cwd: string;
  configPath?: string;
  from?: string;
  filters?: FindingsFilters;
}

function formatLocation(finding: Finding): string {
  if (finding.flowId && finding.checkpointId) {
    return `${finding.flowId}/${finding.checkpointId}`;
  }
  return finding.route ?? finding.url ?? "(unknown)";
}

function resolvedEntry(finding: ResolvedFinding): FindingsEntry {
  const location =
    finding.location.kind === "flow-checkpoint"
      ? `${finding.location.flowId}/${finding.location.checkpointId}`
      : finding.location.route;

  return {
    id: finding.fingerprint,
    fingerprint: finding.fingerprint,
    shortFingerprint: shortFingerprint(finding.fingerprint),
    ruleId: finding.ruleId,
    severity: finding.previousSeverity,
    lifecycleStatus: "resolved",
    disposition: finding.classification?.disposition,
    projectName: finding.projectName,
    location,
    profile:
      finding.location.kind === "flow-checkpoint"
        ? finding.location.profile
        : finding.location.profile,
    viewport: finding.location.viewport,
    owner: finding.classification?.owner,
    ticket: finding.classification?.ticket,
    expiry: finding.classification?.expiresAt,
    reviewAt: finding.classification?.reviewAt,
  };
}

function findingEntry(finding: Finding): FindingsEntry {
  return {
    id: finding.id,
    fingerprint: finding.fingerprint,
    shortFingerprint: shortFingerprint(finding.fingerprint),
    ruleId: finding.ruleId,
    severity: finding.severity,
    lifecycleStatus: finding.baseline?.status ?? "new",
    disposition: finding.baseline?.classification?.disposition,
    projectName: finding.projectName,
    location: formatLocation(finding),
    profile: finding.profile,
    viewport: finding.viewport,
    owner: finding.baseline?.classification?.owner,
    ticket: finding.baseline?.classification?.ticket,
    expiry: finding.baseline?.classification?.expiresAt,
    reviewAt: finding.baseline?.classification?.reviewAt,
  };
}

function matchesFilters(entry: FindingsEntry, filters: FindingsFilters): boolean {
  if (filters.status?.length && !filters.status.includes(entry.lifecycleStatus)) {
    return false;
  }
  if (filters.disposition?.length) {
    if (!entry.disposition || !filters.disposition.includes(entry.disposition)) {
      return false;
    }
  }
  if (filters.project?.length && !filters.project.includes(entry.projectName)) {
    return false;
  }
  if (filters.rule?.length && !filters.rule.includes(entry.ruleId)) {
    return false;
  }
  if (filters.profile?.length && !filters.profile.includes(entry.profile)) {
    return false;
  }
  if (filters.flow?.length) {
    const flowId = entry.location.includes("/") ? entry.location.split("/")[0] : undefined;
    if (!flowId || !filters.flow.includes(flowId)) {
      return false;
    }
  }
  if (filters.checkpoint?.length) {
    const checkpointId = entry.location.includes("/")
      ? entry.location.split("/").slice(1).join("/")
      : undefined;
    if (!checkpointId || !filters.checkpoint.includes(checkpointId)) {
      return false;
    }
  }
  return true;
}

async function enrichWithBaseline(
  cwd: string,
  configPath: string | undefined,
  auditResult: AuditExecutionResult,
): Promise<{
  findings: Finding[];
  resolvedFindings: ResolvedFinding[];
  baselinePath?: string;
  baselineUsed: boolean;
}> {
  const context = await loadBaselineContext({ cwd, configPath });
  if (!(await baselineFileExists(context.baselinePath))) {
    return { findings: auditResult.findings, resolvedFindings: [], baselineUsed: false };
  }

  const baseline = await loadBaselineFile(context.baselinePath);
  const comparison = compareBaselineWithAudit(baseline, auditResult, {
    baselinePath: context.baselinePath,
    applyClassifications: context.baseline.classifications,
  });

  return {
    findings: comparison.findings,
    resolvedFindings: comparison.resolvedFindings,
    baselinePath: context.baselinePath,
    baselineUsed: true,
  };
}

export async function runFindings(options: RunFindingsOptions): Promise<FindingsResult> {
  const { result, resultsPath } = await loadAuditResults({
    cwd: options.cwd,
    resultsPath: options.from,
  });

  const filters = options.filters ?? {};
  const statusFilters = filters.status ?? [];
  const wantsResolved = statusFilters.includes("resolved");
  const activeStatusFilters = statusFilters.filter((value) => value !== "resolved");
  const resolvedOnly = wantsResolved && activeStatusFilters.length === 0 && statusFilters.length > 0;
  const findingFilters: FindingsFilters = {
    ...filters,
    status: activeStatusFilters.length > 0 ? activeStatusFilters : undefined,
  };

  const enriched = await enrichWithBaseline(options.cwd, options.configPath, result);
  const entries: FindingsEntry[] = [];

  if (!resolvedOnly) {
    for (const finding of enriched.findings) {
      const entry = findingEntry(finding);
      if (matchesFilters(entry, findingFilters)) {
        entries.push(entry);
      }
    }
  }

  if (wantsResolved || statusFilters.length === 0) {
    for (const resolved of enriched.resolvedFindings) {
      const entry = resolvedEntry(resolved);
      if (matchesFilters(entry, filters)) {
        entries.push(entry);
      }
    }
  }

  entries.sort((a, b) => {
    const byStatus = a.lifecycleStatus.localeCompare(b.lifecycleStatus);
    if (byStatus !== 0) return byStatus;
    const bySeverity = a.severity.localeCompare(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return a.id.localeCompare(b.id);
  });

  return {
    resultsPath,
    baselinePath: enriched.baselinePath,
    baselineUsed: enriched.baselineUsed,
    entries,
  };
}

function lifecycleLabel(status: string): string {
  return status.toUpperCase();
}

export function formatFindingsHuman(result: FindingsResult): string {
  const lines = ["Findings", ""];
  lines.push(formatLabelValue("Results", result.resultsPath));
  if (result.baselinePath) {
    lines.push(formatLabelValue("Baseline", result.baselinePath));
  }
  lines.push(formatLabelValue("Count", String(result.entries.length)));
  lines.push("");

  if (result.entries.length === 0) {
    lines.push("No findings match the current filters.");
    return lines.join("\n");
  }

  for (const entry of result.entries) {
    lines.push(
      `${entry.severity.toUpperCase().padEnd(9)}${lifecycleLabel(entry.lifecycleStatus).padEnd(11)}${entry.ruleId}`,
    );
    lines.push(formatLabelValue("ID", entry.id));
    lines.push(formatLabelValue("Fingerprint", entry.shortFingerprint));
    lines.push(formatLabelValue("Project", entry.projectName));
    lines.push(formatLabelValue("Location", entry.location));
    lines.push(formatLabelValue("Profile", entry.profile));
    if (entry.viewport) {
      lines.push(formatLabelValue("Viewport", entry.viewport));
    }
    if (entry.disposition) {
      lines.push(formatLabelValue("Disposition", entry.disposition));
    }
    if (entry.owner) {
      lines.push(formatLabelValue("Owner", entry.owner));
    }
    if (entry.ticket) {
      lines.push(formatLabelValue("Ticket", entry.ticket));
    }
    if (entry.expiry) {
      lines.push(formatLabelValue("Expires", entry.expiry));
    }
    if (entry.reviewAt) {
      lines.push(formatLabelValue("Review", entry.reviewAt));
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function formatFindingsJson(result: FindingsResult): unknown {
  return result;
}

export function parseFindingsDisposition(value: string): FindingDisposition {
  const allowed: FindingDisposition[] = [
    "false-positive",
    "accepted-risk",
    "third-party",
    "not-applicable",
    "manual-review",
  ];
  if (!allowed.includes(value as FindingDisposition)) {
    throw new Error(
      `Invalid disposition "${value}". Use one of: ${allowed.join(", ")}.`,
    );
  }
  return value as FindingDisposition;
}

export function parseFindingsStatus(value: string): string {
  const allowed = ["new", "known", "regressed", "resolved"];
  if (!allowed.includes(value)) {
    throw new Error(`Invalid status "${value}". Use one of: ${allowed.join(", ")}.`);
  }
  return value;
}
