import { resolve } from "node:path";
import type {
  FlowConfig,
  FlowStepConfig,
  NormalizedFlow,
  NormalizedFlowStep,
  NormalizedProfileOptions,
  NormalizedViewport,
} from "@a11yst/types";

export class FlowConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlowConfigError";
  }
}

const DEFAULT_STEP_TIMEOUT = 10_000;
const DEFAULT_NAVIGATION_TIMEOUT = 30_000;

function compareText(a: string, b: string): number {
  return a.localeCompare(b);
}

export function collectRequiredEnvVars(steps: FlowStepConfig[]): string[] {
  const vars = new Set<string>();
  for (const step of steps) {
    if (step.action === "fill" && "valueFromEnv" in step && step.valueFromEnv) {
      vars.add(step.valueFromEnv);
    }
  }
  return [...vars].sort(compareText);
}

export function extractCheckpointIds(steps: FlowStepConfig[]): string[] {
  const ids: string[] = [];
  for (const step of steps) {
    if (step.action === "checkpoint") {
      ids.push(step.id);
    }
  }
  return ids;
}

export function normalizeFlow(
  flow: FlowConfig,
  options: {
    projectName: string;
    projectProfileOptions: NormalizedProfileOptions[];
    projectViewports: NormalizedViewport[];
    projectRootDir: string;
    baseOrigin: string;
    defaultStepTimeout?: number;
    defaultNavigationTimeout?: number;
    profileOptions?: NormalizedProfileOptions[];
  },
): NormalizedFlow {
  if (!flow.id?.trim()) {
    throw new FlowConfigError(`Flow in project "${options.projectName}" requires a non-empty id.`);
  }
  if (!flow.start?.trim()) {
    throw new FlowConfigError(`Flow "${flow.id}" requires a start path.`);
  }
  if (!Array.isArray(flow.steps) || flow.steps.length === 0) {
    throw new FlowConfigError(`Flow "${flow.id}" requires at least one step.`);
  }

  const checkpointIds = extractCheckpointIds(flow.steps);
  const uniqueCheckpoints = new Set(checkpointIds);
  if (uniqueCheckpoints.size !== checkpointIds.length) {
    throw new FlowConfigError(`Flow "${flow.id}" contains duplicate checkpoint ids.`);
  }
  if (checkpointIds.length === 0) {
    throw new FlowConfigError(
      `Flow "${flow.id}" requires at least one explicit checkpoint step.`,
    );
  }

  let startUrl: URL;
  try {
    startUrl = new URL(flow.start, options.baseOrigin);
  } catch {
    throw new FlowConfigError(`Flow "${flow.id}" has an invalid start path: ${flow.start}`);
  }
  if (startUrl.origin !== options.baseOrigin) {
    throw new FlowConfigError(
      `Flow "${flow.id}" start "${flow.start}" resolves outside project origin ${options.baseOrigin}.`,
    );
  }

  const profileOptions = options.profileOptions ?? options.projectProfileOptions;
  const profiles = profileOptions.map((entry) => entry.id);

  const viewportNames = flow.viewports?.length
    ? flow.viewports
    : options.projectViewports.map((viewport) => viewport.name);
  const viewportSet = new Set(options.projectViewports.map((viewport) => viewport.name));
  for (const name of viewportNames) {
    if (!viewportSet.has(name)) {
      throw new FlowConfigError(
        `Flow "${flow.id}" references unknown viewport "${name}" for project "${options.projectName}".`,
      );
    }
  }
  const viewports = options.projectViewports.filter((viewport) =>
    viewportNames.includes(viewport.name),
  );

  let storageState: string | undefined;
  if (flow.storageState) {
    storageState = resolve(options.projectRootDir, flow.storageState);
  }

  const steps: NormalizedFlowStep[] = flow.steps.map((step, index) => ({
    ...step,
    index,
  }));

  return {
    id: flow.id,
    name: flow.name ?? flow.id,
    start: flow.start,
    profiles,
    profileOptions,
    viewportNames,
    viewports,
    ...(storageState !== undefined ? { storageState } : {}),
    allowOrigins: flow.allowOrigins ?? [],
    stepTimeout: flow.stepTimeout ?? options.defaultStepTimeout ?? DEFAULT_STEP_TIMEOUT,
    navigationTimeout:
      flow.navigationTimeout ??
      options.defaultNavigationTimeout ??
      DEFAULT_NAVIGATION_TIMEOUT,
    steps,
    checkpointIds,
    requiredEnvVars: collectRequiredEnvVars(flow.steps),
  };
}

export function normalizeProjectFlows(
  flows: FlowConfig[] | undefined,
  options: Parameters<typeof normalizeFlow>[1] & {
    flowProfileResolver?: (flow: FlowConfig) => NormalizedProfileOptions[];
  },
): NormalizedFlow[] {
  if (!flows?.length) return [];
  const ids = new Set<string>();
  const normalized: NormalizedFlow[] = [];
  for (const flow of flows) {
    const profileOptions = options.flowProfileResolver
      ? options.flowProfileResolver(flow)
      : options.projectProfileOptions;
    const item = normalizeFlow(flow, {
      ...options,
      profileOptions,
    });
    if (ids.has(item.id)) {
      throw new FlowConfigError(
        `Duplicate flow id "${item.id}" in project "${options.projectName}".`,
      );
    }
    ids.add(item.id);
    normalized.push(item);
  }
  return normalized.sort((a, b) => compareText(a.id, b.id));
}
