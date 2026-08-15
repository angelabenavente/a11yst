import { resolve } from "node:path";
import { createAdapterContext, resolveAdapter } from "@a11yst/adapters";
import type {
  AdapterId,
  AuditPlan,
  Diagnostic,
  PlannedRun,
  ResolvedConfig,
  ResolvedProject,
  ResolvedWebProject,
} from "@a11yst/types";
import { describeReadinessStrategy } from "./readiness-strategy.js";
import { buildRunId } from "./run-id.js";
import { planFlowCheckpoints } from "./plan-flows.js";

function planWebProject(
  project: ResolvedWebProject,
  configDir: string,
): {
  runs: PlannedRun[];
  diagnostics: Diagnostic[];
} {
  const runs: PlannedRun[] = [];
  const diagnostics: Diagnostic[] = [];

  const projectRoot = resolve(configDir, project.rootDir);
  const adapterContext = createAdapterContext(projectRoot, configDir, project);
  const adapter = resolveAdapter({
    framework: project.framework,
    platform: project.platform,
  });
  const readinessStrategy = adapter
    ? describeReadinessStrategy(project.readiness, adapter.getReadinessStrategy(adapterContext))
    : describeReadinessStrategy(project.readiness);

  for (const route of project.routes) {
    for (const profile of project.profiles) {
      for (const viewport of project.viewports) {
        runs.push({
          id: buildRunId({
            projectName: project.name,
            platform: project.platform,
            framework: project.framework,
            profile,
            routePath: route.path,
            viewportName: viewport.name,
          }),
          kind: "route",
          projectName: project.name,
          platform: project.platform,
          framework: project.framework,
          profile,
          routeId: route.id,
          routeName: route.name,
          route: { ...route },
          viewport: { ...viewport },
          baseUrl: project.baseUrl,
          ...(adapter
            ? {
                adapter: {
                  adapterId: adapter.id as AdapterId,
                  framework: adapter.framework,
                  supportLevel: adapter.supportLevel,
                  routeOrigin: route.origin ?? "explicit",
                  ...(route.pattern !== undefined ? { routePattern: route.pattern } : {}),
                  readinessStrategy,
                },
              }
            : {}),
        });
      }
    }
  }

  if (project.framework === "unknown") {
    diagnostics.push({
      code: "UNKNOWN_FRAMEWORK",
      severity: "info",
      message: `Project "${project.name}" uses framework "unknown".`,
      hint: "Set an explicit framework when known for better future engine selection.",
      path: `projects.${project.name}.framework`,
    });
  }

  return { runs, diagnostics };
}

function planProject(
  project: ResolvedProject,
  configDir: string,
): {
  runs: PlannedRun[];
  diagnostics: Diagnostic[];
} {
  return planWebProject(project, configDir);
}

/**
 * Convert a validated configuration into a deterministic audit plan.
 *
 * Web runs are derived from: project × route × profile × viewport.
 *
 * This function does not open browsers or run accessibility engines.
 */
export function createAuditPlan(config: ResolvedConfig): AuditPlan {
  const projects = config.projects.map((project) => structuredClone(project));
  const runs: PlannedRun[] = [];
  const diagnostics: Diagnostic[] = [...(config.diagnostics ?? [])];

  for (const project of projects) {
    const planned = planProject(project, config.configDir);
    runs.push(...planned.runs);
    diagnostics.push(...planned.diagnostics);
    const flowPlanned = planFlowCheckpoints(project, config.configDir);
    runs.push(...flowPlanned.runs);
    diagnostics.push(...flowPlanned.diagnostics);
  }

  // Stable ordering: already deterministic from config order × nested loops.
  // Sort run ids only as a safety net without changing combination semantics.
  // We keep insertion order so fixtures stay readable.

  diagnostics.push({
    code: "WEB_ENGINE_AVAILABLE",
    severity: "info",
    message: "The Playwright + axe-core web audit engine runs configured web accessibility profiles.",
    hint: "Planning does not open a browser or start a development server.",
  });

  return {
    projects,
    runs,
    totalRuns: runs.length,
    diagnostics,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Freeze a shallow copy of planned runs for immutability-minded consumers.
 */
export function freezeAuditPlan(plan: AuditPlan): Readonly<{
  projects: readonly ResolvedProject[];
  runs: readonly PlannedRun[];
  diagnostics: readonly Diagnostic[];
  totalRuns: number;
  createdAt: string;
}> {
  return Object.freeze({
    ...plan,
    projects: Object.freeze([...plan.projects]),
    runs: Object.freeze([...plan.runs]),
    diagnostics: Object.freeze([...plan.diagnostics]),
  });
}
