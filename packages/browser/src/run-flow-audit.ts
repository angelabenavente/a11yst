import { resolve } from "node:path";
import { URL as NodeURL } from "node:url";
import { chromium } from "playwright";
import {
  auditPageWithProfile,
  captureCheckpointBaseline,
  compareProfileOrder,
  type ProfileEvidenceSink,
} from "@a11yst/profiles";
import {
  buildA11ystFinding,
  evaluateFlowRules,
  getRuleMetadata,
} from "@a11yst/rules";
import {
  executeFlowSession,
  type CheckpointAuditOutcome,
  type FlowEvidenceSink,
} from "@a11yst/flows";
import type {
  AuditRunResult,
  Diagnostic,
  Finding,
  FlowTrace,
  PlannedRun,
  ProfileSnapshot,
  ProgressReporter,
  ResolvedWebProject,
} from "@a11yst/types";
import type { Page } from "playwright";
import { sortFindings } from "./axe-normalize.js";
import { capturePageEvidence, normalizeViewport, type BrowserEvidenceOptions } from "./browser.js";
import { DevServerManager } from "./dev-server.js";

const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;
const DEFAULT_DEV_SERVER_STARTUP_TIMEOUT_MS = 30_000;
const DEFAULT_STEP_TIMEOUT_MS = 10_000;

export interface RunFlowAuditOptions {
  project: ResolvedWebProject;
  runs: PlannedRun[];
  configDir: string;
  evidence?: BrowserEvidenceOptions & {
    writeStructuredEvidence?: (args: {
      run: PlannedRun;
      filename: string;
      data: unknown;
    }) => Promise<string>;
    writeFlowEvidence?: FlowEvidenceSink;
  };
  options: {
    headed?: boolean;
    navigationTimeoutMs?: number;
    stepTimeoutMs?: number;
    noStartServer?: boolean;
    signal?: AbortSignal;
    progress?: ProgressReporter;
    runProgressOffset?: number;
    runProgressTotal?: number;
  };
}

export interface FlowAuditBatchResult {
  runs: AuditRunResult[];
  diagnostics: Diagnostic[];
  serverManaged: boolean;
  flowExecutions: FlowTrace[];
}

const COMPARATIVE_PROFILES = new Set<PlannedRun["profile"]>(["large-text", "reduced-motion"]);

function flowViewportKey(flowId: string, viewportName: string): string {
  return `${flowId}::${viewportName}`;
}

function checkpointBaselineKey(flowId: string, viewportName: string, checkpointId: string): string {
  return `${flowId}::${viewportName}::${checkpointId}`;
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

function groupRunsBySession(runs: PlannedRun[]): Map<string, PlannedRun[]> {
  const groups = new Map<string, PlannedRun[]>();
  for (const run of runs) {
    const key = run.sessionId ?? run.id;
    const existing = groups.get(key);
    if (existing) {
      existing.push(run);
    } else {
      groups.set(key, [run]);
    }
  }
  return groups;
}

function sortFlowRunsForExecution(runs: PlannedRun[]): PlannedRun[] {
  return [...runs].sort(
    (a, b) =>
      compareStrings(a.flowId ?? "", b.flowId ?? "") ||
      compareStrings(a.checkpointId ?? "", b.checkpointId ?? "") ||
      compareProfileOrder(a.profile, b.profile) ||
      compareStrings(a.viewport?.name ?? "", b.viewport?.name ?? ""),
  );
}

function failedFlowResult(
  project: ResolvedWebProject,
  run: PlannedRun,
  message: string,
  diagnostics: Diagnostic[] = [],
): AuditRunResult {
  return {
    runId: run.id,
    kind: "flow-checkpoint",
    projectName: project.name,
    platform: project.platform,
    framework: project.framework,
    profile: run.profile,
    viewport: run.viewport,
    status: "failed",
    startedAt: new Date().toISOString(),
    durationMs: 0,
    findings: [],
    diagnostics,
    skipReason: message,
    sessionId: run.sessionId,
    flowId: run.flowId,
    flowName: run.flowName,
    checkpointId: run.checkpointId,
    checkpointName: run.checkpointName,
    route: run.flowStart,
    url: run.baseUrl ?? project.baseUrl,
    ...(run.adapter !== undefined ? { adapter: run.adapter } : {}),
  };
}

function skippedFlowResult(
  project: ResolvedWebProject,
  run: PlannedRun,
  message: string,
): AuditRunResult {
  return {
    runId: run.id,
    kind: "flow-checkpoint",
    projectName: project.name,
    platform: project.platform,
    framework: project.framework,
    profile: run.profile,
    viewport: run.viewport,
    status: "skipped",
    startedAt: new Date().toISOString(),
    durationMs: 0,
    findings: [],
    diagnostics: [
      {
        code: "FLOW_CHECKPOINT_SKIPPED",
        severity: "warning",
        message,
        path: `runs.${run.id}`,
      },
    ],
    skipReason: message,
    sessionId: run.sessionId,
    flowId: run.flowId,
    flowName: run.flowName,
    checkpointId: run.checkpointId,
    checkpointName: run.checkpointName,
    route: run.flowStart,
    url: run.baseUrl ?? project.baseUrl,
    ...(run.adapter !== undefined ? { adapter: run.adapter } : {}),
  };
}

export async function runFlowAudit(options: RunFlowAuditOptions): Promise<FlowAuditBatchResult> {
  const { project, runs, configDir } = options;
  const navigationTimeoutMs =
    options.options.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS;
  const stepTimeoutMs = options.options.stepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
  const diagnostics: Diagnostic[] = [];
  const sortedRuns = sortFlowRunsForExecution(runs);

  if (sortedRuns.length === 0) {
    return { runs: [], diagnostics, serverManaged: false, flowExecutions: [] };
  }

  const rootDir = resolve(configDir, project.rootDir);
  const devServerManager = new DevServerManager();
  let serverManaged = false;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

  const progress = options.options.progress;
  const runProgressOffset = options.options.runProgressOffset ?? 0;
  const runProgressTotal = options.options.runProgressTotal ?? sortedRuns.length;
  const readinessUrl = project.devServer?.url ?? project.baseUrl;

  try {
    try {
      progress?.start(`Waiting for ${readinessUrl}…`);
      const ensureResult = await devServerManager.ensureReady({
        rootDir,
        url: project.baseUrl,
        command: project.devServer?.command,
        reuseExisting: project.devServer?.reuseExisting ?? true,
        startupTimeout: project.devServer?.startupTimeout ?? DEFAULT_DEV_SERVER_STARTUP_TIMEOUT_MS,
        noStartServer: options.options.noStartServer,
        signal: options.options.signal,
      });
      serverManaged = ensureResult.managed;
      diagnostics.push(...devServerManager.diagnostics);
      progress?.succeed(`Server ready · ${readinessUrl}`);
    } catch (error) {
      progress?.fail(`Dev server was not ready · ${readinessUrl}`);
      diagnostics.push(...devServerManager.diagnostics);
      const message = error instanceof Error ? error.message : String(error);
      diagnostics.push({
        code: "DEV_SERVER_NOT_READY",
        severity: "error",
        message: `Dev server was not ready: ${message}`,
      });
      return {
        runs: sortedRuns.map((run) =>
          failedFlowResult(project, run, `Dev server was not ready: ${message}`),
        ),
        diagnostics,
        serverManaged: false,
        flowExecutions: [],
      };
    }

    const baseOrigin = new NodeURL(project.baseUrl).origin;
    const baselineByCheckpoint = new Map<string, ProfileSnapshot>();
    const explicitDefaultFlowViewports = new Set<string>();
    for (const run of sortedRuns) {
      if (run.profile === "default" && run.flowId) {
        explicitDefaultFlowViewports.add(
          flowViewportKey(run.flowId, run.viewport?.name ?? "default"),
        );
      }
    }

    const flowExecutions: FlowTrace[] = [];
    const results: AuditRunResult[] = [];

    try {
      progress?.start("Launching Chromium…");
      browser = await chromium.launch({
        channel: "chromium",
        headless: !options.options.headed,
      });
      progress?.succeed("Chromium ready");
    } catch (error) {
      progress?.fail("Chromium launch failed");
      const message = error instanceof Error ? error.message : String(error);
      return {
        runs: sortedRuns.map((run) => failedFlowResult(project, run, `Browser failure: ${message}`)),
        diagnostics,
        serverManaged,
        flowExecutions: [],
      };
    }

    const sessionGroups = groupRunsBySession(sortedRuns);
    const orderedSessions = [...sessionGroups.entries()].sort(([, runsA], [, runsB]) => {
      const profileA = runsA[0]?.profile ?? "default";
      const profileB = runsB[0]?.profile ?? "default";
      if (profileA === "default" && profileB !== "default") return -1;
      if (profileB === "default" && profileA !== "default") return 1;
      return compareStrings(runsA[0]?.flowId ?? "", runsB[0]?.flowId ?? "");
    });

    async function ensureInternalBaselines(
      flow: NonNullable<typeof project.flows[number]>,
      viewport: ReturnType<typeof normalizeViewport>,
      representative: PlannedRun,
    ): Promise<boolean> {
      const fvKey = flowViewportKey(flow.id, viewport.name);
      if (explicitDefaultFlowViewports.has(fvKey)) {
        return true;
      }
      if (!COMPARATIVE_PROFILES.has(representative.profile)) {
        return true;
      }
      const missing = flow.checkpointIds.some(
        (checkpointId) =>
          !baselineByCheckpoint.has(checkpointBaselineKey(flow.id, viewport.name, checkpointId)),
      );
      if (!missing) {
        return true;
      }

      try {
        await executeFlowSession({
          browser: browser!,
          flow,
          projectName: project.name,
          profile: "default",
          viewport,
          baseOrigin,
          baseUrl: project.baseUrl,
          startPath: flow.start,
          storageState: flow.storageState,
          stepTimeout: stepTimeoutMs,
          navigationTimeout: navigationTimeoutMs,
          signal: options.options.signal,
          auditCheckpoint: async (request) => {
            const snapshot = await captureCheckpointBaseline(request.page);
            baselineByCheckpoint.set(
              checkpointBaselineKey(flow.id, viewport.name, request.checkpointId),
              snapshot,
            );
            return { findings: [], diagnostics: [] };
          },
          evaluateFlowRules: async () => [],
        });
        diagnostics.push({
          code: "INTERNAL_DEFAULT_BASELINE",
          severity: "info",
          message: `Captured an internal default-profile reference for flow "${flow.id}" (${viewport.name}) before running "${representative.profile}".`,
          path: `flows.${flow.id}`,
        });
        return true;
      } catch (error) {
        diagnostics.push({
          code: "INTERNAL_DEFAULT_BASELINE_FAILED",
          severity: "error",
          message: `Could not capture internal default baseline for flow "${flow.id}": ${error instanceof Error ? error.message : String(error)}`,
          path: `flows.${flow.id}`,
        });
        return false;
      }
    }

    let completedRunCount = 0;
    for (const [sessionId, sessionRuns] of orderedSessions) {
      if (options.options.signal?.aborted) {
        for (const run of sessionRuns) {
          results.push(failedFlowResult(project, run, "Audit was aborted before this flow started."));
        }
        continue;
      }

      const representative = sessionRuns[0]!;
      const flow = project.flows.find((candidate) => candidate.id === representative.flowId);
      if (!flow) {
        for (const run of sessionRuns) {
          results.push(
            failedFlowResult(project, run, `Flow "${representative.flowId}" was not found in project config.`),
          );
        }
        continue;
      }

      const checkpointFindings = new Map<string, Finding[]>();
      const checkpointProfileMetadata = new Map<string, Record<string, unknown>>();
      const startedAt = new Date();

      const profileEvidenceSink: ProfileEvidenceSink | undefined =
        options.evidence?.screenshots || options.evidence?.writeStructuredEvidence
          ? {
              writeStructuredEvidence: async ({ run, filename, data }) =>
                options.evidence?.writeStructuredEvidence?.({ run, filename, data }) ?? filename,
              writeRunScreenshot: options.evidence?.sink
                ? async ({ run, data }) => options.evidence!.sink!.writeRunScreenshot({ run, data })
                : undefined,
            }
          : undefined;

      const captureScreenshots = options.evidence?.screenshots ?? false;
      const evidenceSinkForRun = options.evidence?.sink;

      const viewportConfig =
        flow.viewports.find((v) => v.name === representative.viewport?.name) ??
        flow.viewports[0]!;
      const viewport = normalizeViewport(viewportConfig);

      if (COMPARATIVE_PROFILES.has(representative.profile)) {
        const baselineReady = await ensureInternalBaselines(flow, viewport, representative);
        if (!baselineReady) {
          for (const run of sessionRuns) {
            results.push(
              failedFlowResult(
                project,
                run,
                "Could not capture internal default baseline for comparative profile audit.",
              ),
            );
          }
          continue;
        }
      }

      const viewportName = representative.viewport?.name ?? "default";
      progress?.progress(
        runProgressOffset + completedRunCount + 1,
        runProgressTotal,
        `Running flow ${flow.id} · ${representative.profile} · ${viewportName}`,
      );

      let sessionResult;
      try {
        sessionResult = await executeFlowSession({
          browser,
          flow,
          projectName: project.name,
          profile: representative.profile,
          viewport,
          baseOrigin,
          baseUrl: project.baseUrl,
          startPath: flow.start,
          storageState: flow.storageState,
          stepTimeout: stepTimeoutMs,
          navigationTimeout: navigationTimeoutMs,
          signal: options.options.signal,
          evidenceSink: options.evidence?.writeFlowEvidence,
          auditCheckpoint: async (request): Promise<CheckpointAuditOutcome> => {
            const plannedRun = sessionRuns.find((run) => run.checkpointId === request.checkpointId);
            const activeRun = plannedRun ?? representative;
            const enrichFindingEvidence =
              captureScreenshots && evidenceSinkForRun
                ? async ({
                    page,
                    run,
                    findings,
                  }: {
                    page: Page;
                    run: PlannedRun;
                    findings: Finding[];
                  }) =>
                    capturePageEvidence({
                      page,
                      run,
                      findings,
                      options: {
                        screenshots: true,
                        fullPage: options.evidence?.fullPage ?? false,
                        sink: evidenceSinkForRun,
                      },
                    })
                : undefined;

            const baselineKey = checkpointBaselineKey(
              flow.id,
              activeRun.viewport?.name ?? "default",
              request.checkpointId,
            );
            const baselineSnapshot = baselineByCheckpoint.get(baselineKey);
            const usedInternalBaseline =
              Boolean(baselineSnapshot) &&
              activeRun.profile !== "default" &&
              !explicitDefaultFlowViewports.has(
                flowViewportKey(flow.id, activeRun.viewport?.name ?? "default"),
              );

            const outcome = await auditPageWithProfile({
              page: request.page,
              run: activeRun,
              projectName: project.name,
              profileOptionsList: project.profileOptions,
              viewport: activeRun.viewport,
              baselineSnapshot,
              evidenceSink: profileEvidenceSink,
              captureScreenshots: captureScreenshots && !enrichFindingEvidence,
              enrichFindingEvidence,
              flowId: flow.id,
              checkpointId: request.checkpointId,
              normalizationContext: {
                projectName: project.name,
                route: flow.start,
                viewport: activeRun.viewport?.name,
              },
            });

            if (activeRun.profile === "default" && outcome.snapshot) {
              baselineByCheckpoint.set(baselineKey, outcome.snapshot);
            }

            const profileMetadata = {
              ...outcome.profileMetadata,
              ...(usedInternalBaseline ? { internalReferenceProfile: "default" as const } : {}),
            };

            const taggedFindings = outcome.findings.map((finding) => ({
              ...finding,
              flowId: flow.id,
              checkpointId: request.checkpointId,
            }));
            checkpointFindings.set(request.checkpointId, taggedFindings);
            checkpointProfileMetadata.set(request.checkpointId, profileMetadata);

            let screenshot = outcome.screenshot;
            if (
              options.evidence?.writeFlowEvidence?.writeCheckpointScreenshot &&
              !screenshot
            ) {
              try {
                const data = await request.page.screenshot({ animations: "disabled" });
                screenshot = await options.evidence.writeFlowEvidence.writeCheckpointScreenshot({
                  flowId: flow.id,
                  checkpointId: request.checkpointId,
                  profile: activeRun.profile,
                  viewportName: activeRun.viewport?.name ?? "default",
                  data,
                });
              } catch {
                // optional
              }
            }

            return {
              findings: taggedFindings,
              diagnostics: outcome.diagnostics,
              ...(screenshot ? { screenshot } : {}),
              profileEvidence: outcome.evidence,
              coverage: outcome.coverage,
              profileMetadata,
            };
          },
          evaluateFlowRules: async (page, steps, checkpointId) => {
            const activeRun = sessionRuns.find((run) => run.checkpointId === checkpointId) ?? representative;
            const ruleInputs = evaluateFlowRules(
              { steps },
              {
                projectName: project.name,
                profile: activeRun.profile,
                url: page.url(),
                viewport: activeRun.viewport?.name,
                flowId: flow.id,
                checkpointId,
              },
            );
            const flowFindings = ruleInputs.map((input) => {
              const metadata = getRuleMetadata(input.ruleId);
              if (!metadata) {
                throw new Error(`Missing rule metadata for "${input.ruleId}".`);
              }
              return buildA11ystFinding(
                input,
                {
                  projectName: project.name,
                  profile: activeRun.profile,
                  url: page.url(),
                  viewport: activeRun.viewport?.name,
                  flowId: flow.id,
                  checkpointId,
                },
                metadata,
              );
            });
            const existing = checkpointFindings.get(checkpointId) ?? [];
            checkpointFindings.set(checkpointId, [...existing, ...flowFindings]);
            return flowFindings;
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        for (const run of sessionRuns) {
          results.push(failedFlowResult(project, run, `Flow session failed: ${message}`));
        }
        continue;
      }

      diagnostics.push(...sessionResult.diagnostics);

      if (sessionResult.tracePath || sessionResult.steps.length > 0) {
        flowExecutions.push({
          schemaVersion: "1",
          projectName: project.name,
          flowId: flow.id,
          flowName: flow.name,
          profile: representative.profile,
          viewport: viewport.name,
          sessionId,
          startedAt: startedAt.toISOString(),
          durationMs: sessionResult.durationMs,
          status: sessionResult.status,
          steps: sessionResult.steps,
          checkpoints: sessionResult.checkpoints,
          diagnostics: sessionResult.diagnostics,
        });
      }

      for (const run of sessionRuns) {
        const checkpoint = sessionResult.checkpoints.find(
          (entry) => entry.checkpointId === run.checkpointId,
        );
        const findings = sortFindings(checkpointFindings.get(run.checkpointId ?? "") ?? []);

        if (!checkpoint || checkpoint.status === "skipped") {
          results.push(
            skippedFlowResult(
              project,
              run,
              checkpoint?.diagnostics[0]?.message ??
                "Checkpoint was skipped because an earlier flow step failed.",
            ),
          );
          continue;
        }

        if (sessionResult.status === "failed" && checkpoint.status !== "completed") {
          results.push(
            failedFlowResult(
              project,
              run,
              sessionResult.diagnostics.find((entry) => entry.severity === "error")?.message ??
                "Flow failed before this checkpoint completed.",
            ),
          );
          continue;
        }

        results.push({
          runId: run.id,
          kind: "flow-checkpoint",
          projectName: project.name,
          platform: project.platform,
          framework: project.framework,
          profile: run.profile,
          viewport: run.viewport,
          status: "completed",
          startedAt: startedAt.toISOString(),
          durationMs: sessionResult.durationMs,
          findings,
          diagnostics: checkpoint.diagnostics,
          sessionId,
          flowId: run.flowId,
          flowName: run.flowName,
          checkpointId: run.checkpointId,
          checkpointName: run.checkpointName,
          route: run.flowStart,
          url: checkpoint.url ?? project.baseUrl,
          flowTracePath: sessionResult.tracePath,
          profileMetadata: checkpointProfileMetadata.get(run.checkpointId ?? ""),
          ...(run.adapter !== undefined ? { adapter: run.adapter } : {}),
          evidence: {
            screenshot: checkpoint.evidence?.[0],
            documentTitle: checkpoint.documentTitle,
            finalUrl: checkpoint.url,
            capturedAt: checkpoint.startedAt ?? startedAt.toISOString(),
            viewport: normalizeViewport(run.viewport),
          },
        });
      }
      completedRunCount += sessionRuns.length;
    }

    return { runs: results, diagnostics, serverManaged, flowExecutions };
  } finally {
    await browser?.close().catch(() => undefined);
    await devServerManager.stop();
  }
}
