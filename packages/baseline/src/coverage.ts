import type {
  AuditExecutionResult,
  AuditRunResult,
  BaselineEntry,
  ComparisonCoverage,
  FindingLocation,
} from "@a11yst/types";

export function buildComparisonCoverage(result: AuditExecutionResult): ComparisonCoverage {
  const comparedProjects = new Set<string>();
  const comparedProfiles = new Set<string>();
  const comparedViewports = new Set<string>();
  const comparedRoutes = new Set<string>();
  const comparedFlows = new Map<string, Set<string>>();
  const failedRuns: string[] = [];
  const skippedRuns: string[] = [];

  const plannedProjects = new Set(result.plan.projects.map((project) => project.name));

  for (const run of result.runs) {
    if (run.status === "failed") {
      failedRuns.push(run.runId);
      continue;
    }
    if (run.status === "skipped") {
      skippedRuns.push(run.runId);
      continue;
    }
    if (run.status !== "completed") {
      continue;
    }

    comparedProjects.add(run.projectName);
    comparedProfiles.add(run.profile);
    if (run.viewport?.name) {
      comparedViewports.add(run.viewport.name);
    }

    if (run.kind === "flow-checkpoint" || run.flowId) {
      if (run.flowId && run.checkpointId) {
        const checkpoints = comparedFlows.get(run.flowId) ?? new Set<string>();
        checkpoints.add(run.checkpointId);
        comparedFlows.set(run.flowId, checkpoints);
      }
    } else if (run.route) {
      comparedRoutes.add(run.route);
    }
  }

  const excludedProjects = [...plannedProjects]
    .filter((project) => !comparedProjects.has(project))
    .sort();

  return {
    comparedProjects: [...comparedProjects].sort(),
    comparedProfiles: [...comparedProfiles].sort(),
    comparedViewports: [...comparedViewports].sort(),
    comparedRoutes: [...comparedRoutes].sort(),
    comparedFlows: [...comparedFlows.entries()]
      .map(([flowId, checkpointIds]) => ({
        flowId,
        checkpointIds: [...checkpointIds].sort(),
      }))
      .sort((a, b) => a.flowId.localeCompare(b.flowId)),
    excludedProjects,
    failedRuns: failedRuns.sort(),
    skippedRuns: skippedRuns.sort(),
  };
}

export function entryInComparisonCoverage(
  entry: BaselineEntry,
  coverage: ComparisonCoverage,
): boolean {
  if (!coverage.comparedProjects.includes(entry.projectName)) {
    return false;
  }
  if (!coverage.comparedProfiles.includes(entry.location.profile)) {
    return false;
  }

  const viewport = entry.location.viewport;
  if (
    viewport &&
    coverage.comparedViewports.length > 0 &&
    !coverage.comparedViewports.includes(viewport)
  ) {
    return false;
  }

  return locationInComparisonCoverage(entry.location, coverage);
}

export function locationInComparisonCoverage(
  location: FindingLocation,
  coverage: ComparisonCoverage,
): boolean {
  if (location.kind === "route") {
    return coverage.comparedRoutes.includes(location.route);
  }

  const flow = coverage.comparedFlows.find((candidate) => candidate.flowId === location.flowId);
  if (!flow) {
    return false;
  }
  return flow.checkpointIds.includes(location.checkpointId);
}

export function runCoversBaselineEntry(
  entry: BaselineEntry,
  run: AuditRunResult,
): boolean {
  if (run.status !== "completed") {
    return false;
  }
  if (run.projectName !== entry.projectName) {
    return false;
  }
  if (run.profile !== entry.location.profile) {
    return false;
  }
  const entryViewport = entry.location.viewport;
  const runViewport = run.viewport?.name;
  if (entryViewport && runViewport && entryViewport !== runViewport) {
    return false;
  }

  if (entry.location.kind === "flow-checkpoint") {
    return (
      run.flowId === entry.location.flowId &&
      run.checkpointId === entry.location.checkpointId
    );
  }

  return run.route === entry.location.route;
}
