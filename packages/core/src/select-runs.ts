import type { AccessibilityProfile, AuditPlan, PlannedRun } from "@a11yst/types";

/**
 * Web accessibility profiles are executable for web platform runs.
 * React Native profile runs remain skipped in this phase.
 */
export function isExecutableRun(run: PlannedRun): boolean {
  return run.platform === "web";
}

export function isFlowCheckpointRun(run: PlannedRun): boolean {
  return run.kind === "flow-checkpoint";
}

export function isRouteRun(run: PlannedRun): boolean {
  return run.kind === "route" || run.kind === undefined;
}

export function skipReasonForRun(_run: PlannedRun): string | undefined {
  return undefined;
}

export class UnknownProjectError extends Error {
  readonly unknownNames: string[];
  readonly knownNames: string[];

  constructor(unknownNames: string[], knownNames: string[]) {
    super(
      `Unknown project name(s): ${unknownNames.join(", ")}. ` +
        `Known project(s): ${knownNames.length > 0 ? knownNames.join(", ") : "(none)"}.`,
    );
    this.name = "UnknownProjectError";
    this.unknownNames = unknownNames;
    this.knownNames = knownNames;
  }
}

export class UnknownProfileError extends Error {
  readonly unknownProfiles: AccessibilityProfile[];
  readonly knownProfiles: AccessibilityProfile[];

  constructor(unknownProfiles: AccessibilityProfile[], knownProfiles: AccessibilityProfile[]) {
    super(
      `Unknown or unconfigured profile(s): ${unknownProfiles.join(", ")}. ` +
        `Configured profile(s): ${knownProfiles.join(", ")}.`,
    );
    this.name = "UnknownProfileError";
    this.unknownProfiles = unknownProfiles;
    this.knownProfiles = knownProfiles;
  }
}

export class UnknownFlowError extends Error {
  readonly unknownFlows: string[];
  readonly knownFlows: string[];

  constructor(unknownFlows: string[], knownFlows: string[]) {
    super(
      `Unknown flow id(s): ${unknownFlows.join(", ")}. ` +
        `Configured flow(s): ${knownFlows.length > 0 ? knownFlows.join(", ") : "(none)"}.`,
    );
    this.name = "UnknownFlowError";
    this.unknownFlows = unknownFlows;
    this.knownFlows = knownFlows;
  }
}

export class AuditSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditSelectionError";
  }
}

export interface SelectRunsOptions {
  projectNames?: string[];
  profileNames?: AccessibilityProfile[];
  flowNames?: string[];
  routesOnly?: boolean;
  flowsOnly?: boolean;
}

export interface SelectRunsResult {
  executable: PlannedRun[];
  skipped: PlannedRun[];
}

function collectKnownFlowIds(plan: { projects?: AuditPlan["projects"] }): string[] {
  const ids = new Set<string>();
  for (const project of plan.projects ?? []) {
    if (project.platform !== "web") continue;
    for (const flow of project.flows) {
      ids.add(flow.id);
    }
  }
  return [...ids].sort();
}

export function selectRuns(
  plan: Pick<AuditPlan, "runs"> & { projects?: AuditPlan["projects"] },
  options: SelectRunsOptions = {},
): SelectRunsResult {
  const { projectNames, profileNames, flowNames, routesOnly, flowsOnly } = options;

  if (routesOnly && flowsOnly) {
    throw new AuditSelectionError(
      "Cannot use --routes-only and --flows-only together. Choose one audit mode.",
    );
  }

  let candidateRuns = plan.runs;

  if (projectNames && projectNames.length > 0) {
    const knownNames = [...new Set(plan.runs.map((run) => run.projectName))];
    const knownSet = new Set(knownNames);
    const unknownNames = [...new Set(projectNames.filter((name) => !knownSet.has(name)))];
    if (unknownNames.length > 0) {
      throw new UnknownProjectError(unknownNames, knownNames);
    }
    const selectedNames = new Set(projectNames);
    candidateRuns = candidateRuns.filter((run) => selectedNames.has(run.projectName));
  }

  if (profileNames && profileNames.length > 0) {
    const configuredProfiles = new Set<AccessibilityProfile>();
    for (const project of plan.projects ?? []) {
      for (const profile of project.profiles) {
        configuredProfiles.add(profile);
      }
    }
    const requested = [...new Set(profileNames)];
    const unknownProfiles = requested.filter((profile) => !configuredProfiles.has(profile));
    if (unknownProfiles.length > 0) {
      throw new UnknownProfileError(unknownProfiles, [...configuredProfiles]);
    }
    const selectedProfiles = new Set(profileNames);
    candidateRuns = candidateRuns.filter((run) => selectedProfiles.has(run.profile));
  }

  if (flowNames && flowNames.length > 0) {
    const knownFlows = collectKnownFlowIds(plan);
    const knownSet = new Set(knownFlows);
    const unknownFlows = [...new Set(flowNames.filter((id) => !knownSet.has(id)))];
    if (unknownFlows.length > 0) {
      throw new UnknownFlowError(unknownFlows, knownFlows);
    }
    const selectedFlows = new Set(flowNames);
    candidateRuns = candidateRuns.filter(
      (run) => run.flowId !== undefined && selectedFlows.has(run.flowId),
    );
  } else if (flowsOnly) {
    candidateRuns = candidateRuns.filter((run) => isFlowCheckpointRun(run));
  } else if (routesOnly) {
    candidateRuns = candidateRuns.filter((run) => isRouteRun(run));
  } else if (flowNames === undefined && !routesOnly && !flowsOnly) {
    // Default: include both route and flow runs.
  }

  const executable: PlannedRun[] = [];
  const skipped: PlannedRun[] = [];
  for (const run of candidateRuns) {
    if (isExecutableRun(run)) {
      executable.push(run);
    } else {
      skipped.push(run);
    }
  }

  return { executable, skipped };
}
