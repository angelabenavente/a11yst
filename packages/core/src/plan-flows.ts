import type { PlannedRun, ResolvedWebProject } from "@a11yst/types";
import { buildFlowCheckpointRunId, buildFlowSessionId } from "@a11yst/flows";
import { describeReadinessStrategy } from "./readiness-strategy.js";
import { createAdapterContext, resolveAdapter } from "@a11yst/adapters";
import { resolve } from "node:path";
import type { AdapterId, Diagnostic } from "@a11yst/types";

export function planFlowCheckpoints(
  project: ResolvedWebProject,
  configDir: string,
): { runs: PlannedRun[]; diagnostics: Diagnostic[] } {
  const runs: PlannedRun[] = [];
  const diagnostics: Diagnostic[] = [];

  if (project.flows.length === 0) {
    return { runs, diagnostics };
  }

  const projectRoot = resolve(configDir, project.rootDir);
  const adapterContext = createAdapterContext(projectRoot, configDir, project);
  const adapter = resolveAdapter({
    framework: project.framework,
    platform: project.platform,
  });
  const readinessStrategy = adapter
    ? describeReadinessStrategy(project.readiness, adapter.getReadinessStrategy(adapterContext))
    : describeReadinessStrategy(project.readiness);

  for (const flow of project.flows) {
    for (const checkpointId of flow.checkpointIds) {
      const checkpointStep = flow.steps.find(
        (step) => step.action === "checkpoint" && step.id === checkpointId,
      );
      const checkpointName =
        checkpointStep?.action === "checkpoint"
          ? checkpointStep.name ?? checkpointStep.id
          : checkpointId;

      for (const profile of flow.profiles) {
        for (const viewport of flow.viewports) {
          const sessionId = buildFlowSessionId({
            projectName: project.name,
            flowId: flow.id,
            profile,
            viewportName: viewport.name,
          });

          runs.push({
            id: buildFlowCheckpointRunId({
              projectName: project.name,
              flowId: flow.id,
              checkpointId,
              profile,
              viewportName: viewport.name,
            }),
            kind: "flow-checkpoint",
            sessionId,
            projectName: project.name,
            platform: project.platform,
            framework: project.framework,
            profile,
            flowId: flow.id,
            flowName: flow.name,
            checkpointId,
            checkpointName,
            flowStart: flow.start,
            viewport: { ...viewport },
            baseUrl: project.baseUrl,
            ...(adapter
              ? {
                  adapter: {
                    adapterId: adapter.id as AdapterId,
                    framework: adapter.framework,
                    supportLevel: adapter.supportLevel,
                    routeOrigin: "explicit",
                    readinessStrategy,
                  },
                }
              : {}),
          });
        }
      }
    }
  }

  diagnostics.push({
    code: "FLOW_PLANNING",
    severity: "info",
    message: `Planned ${project.flows.length} flow(s) with checkpoint runs for project "${project.name}".`,
    path: `projects.${project.name}.flows`,
  });

  return { runs, diagnostics };
}
