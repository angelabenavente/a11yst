import type {
  AuditPlan,
  AuditProfileSummary,
  AuditRunResult,
  AuditSummary,
  FlowSummary,
  FindingAutomation,
  FindingConfidence,
  ProfileId,
  Severity,
} from "@a11yst/types";

export function emptySeverityCounts(): Record<Severity, number> {
  return {
    critical: 0,
    high: 0,
    medium: 0,
    minor: 0,
  };
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function sortRunResults(runs: readonly AuditRunResult[]): AuditRunResult[] {
  return [...runs].sort(
    (a, b) =>
      compareStrings(a.projectName, b.projectName) ||
      compareStrings(a.route ?? "", b.route ?? "") ||
      compareStrings(a.profile, b.profile) ||
      compareStrings(a.viewport?.name ?? "", b.viewport?.name ?? ""),
  );
}

export function aggregateSummary(runs: readonly AuditRunResult[], startedAt: string): AuditSummary {
  const findingsBySeverity = emptySeverityCounts();
  let completedRuns = 0;
  let skippedRuns = 0;
  let failedRuns = 0;
  let findingCount = 0;

  for (const run of runs) {
    if (run.status === "completed") {
      completedRuns += 1;
    } else if (run.status === "skipped") {
      skippedRuns += 1;
    } else {
      failedRuns += 1;
    }

    for (const finding of run.findings) {
      findingCount += 1;
      findingsBySeverity[finding.severity] += 1;
    }
  }

  let status: AuditSummary["status"];
  if (failedRuns === 0) {
    status = "completed";
  } else if (completedRuns > 0) {
    status = "completed-with-errors";
  } else {
    status = "failed";
  }

  const durationMs = Math.max(0, Date.now() - new Date(startedAt).getTime());

  return {
    status,
    startedAt,
    durationMs,
    plannedRuns: runs.length,
    completedRuns,
    skippedRuns,
    failedRuns,
    findingCount,
    findingsBySeverity,
  };
}

export function buildProfileSummary(runs: readonly AuditRunResult[]): AuditProfileSummary {
  const completed = new Set<ProfileId>();
  const failed = new Set<ProfileId>();
  const skipped = new Set<ProfileId>();
  const coverage = runs
    .map((run) => run.coverage)
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

  for (const run of runs) {
    if (run.internalBaseline) continue;
    if (run.status === "completed") completed.add(run.profile);
    else if (run.status === "skipped") skipped.add(run.profile);
    else failed.add(run.profile);
  }

  const findingsBySource = { axe: 0, a11yst: 0 };
  const findingsByAutomation: Record<FindingAutomation, number> = {
    automated: 0,
    heuristic: 0,
    "manual-review": 0,
  };
  const findingsByConfidence: Record<FindingConfidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  let manualReviewPending = 0;

  for (const run of runs) {
    for (const finding of run.findings) {
      findingsBySource[finding.source] += 1;
      const automation = finding.automation ?? (finding.source === "axe" ? "automated" : "heuristic");
      findingsByAutomation[automation] += 1;
      const confidence = finding.confidence ?? (finding.source === "axe" ? "high" : "medium");
      findingsByConfidence[confidence] += 1;
      if (automation === "manual-review") manualReviewPending += 1;
    }
  }

  return {
    completed: [...completed].sort(),
    failed: [...failed].sort(),
    skipped: [...skipped].sort(),
    coverage,
    findingsBySource,
    findingsByAutomation,
    findingsByConfidence,
    manualReviewPending,
  };
}

export function buildFlowSummary(
  plan: Pick<AuditPlan, "projects">,
  runs: readonly AuditRunResult[],
): FlowSummary | undefined {
  let configuredFlows = 0;
  for (const project of plan.projects ?? []) {
    if (project.platform !== "web") continue;
    configuredFlows += project.flows.length;
  }
  if (configuredFlows === 0) {
    return undefined;
  }

  const flowRuns = runs.filter((run) => run.kind === "flow-checkpoint");
  if (flowRuns.length === 0) {
    return {
      configuredFlows,
      completedFlows: 0,
      failedFlows: 0,
      completedCheckpoints: 0,
      skippedCheckpoints: 0,
      failedCheckpoints: 0,
    };
  }

  const sessions = new Map<string, AuditRunResult[]>();
  for (const run of flowRuns) {
    const key = `${run.projectName}::${run.flowId}::${run.profile}::${run.viewport?.name ?? "default"}`;
    const existing = sessions.get(key);
    if (existing) {
      existing.push(run);
    } else {
      sessions.set(key, [run]);
    }
  }

  let completedFlows = 0;
  let failedFlows = 0;
  let completedCheckpoints = 0;
  let skippedCheckpoints = 0;
  let failedCheckpoints = 0;

  for (const session of sessions.values()) {
    const hasFailed = session.some((run) => run.status === "failed");
    const hasCompleted = session.some((run) => run.status === "completed");
    if (hasFailed && !hasCompleted) {
      failedFlows += 1;
    } else if (hasCompleted) {
      completedFlows += 1;
    }

    for (const run of session) {
      if (run.status === "completed") completedCheckpoints += 1;
      else if (run.status === "skipped") skippedCheckpoints += 1;
      else failedCheckpoints += 1;
    }
  }

  return {
    configuredFlows,
    completedFlows,
    failedFlows,
    completedCheckpoints,
    skippedCheckpoints,
    failedCheckpoints,
  };
}
