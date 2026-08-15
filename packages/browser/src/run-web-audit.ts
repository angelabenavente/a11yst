import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  compareProfileOrder,
  runProfileAudit,
  originOf,
  TargetOriginMismatchError,
  targetOriginMismatchDiagnostic,
  type ProfileEvidenceSink,
} from "@a11yst/profiles";
import type {
  AuditRunResult,
  Diagnostic,
  Finding,
  PlannedRun,
  ProfileSnapshot,
  ProgressReporter,
  ResolvedWebProject,
} from "@a11yst/types";
import type { Page } from "playwright";
import { sortFindings } from "./axe-normalize.js";
import { mergeRunReadiness } from "./readiness.js";
import { buildPageUrl } from "./url.js";
import { DevServerManager } from "./dev-server.js";
import { capturePageEvidence, normalizeViewport, type BrowserEvidenceOptions } from "./browser.js";

const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;
const DEFAULT_DEV_SERVER_STARTUP_TIMEOUT_MS = 30_000;

export interface RunWebAuditOptions {
  project: ResolvedWebProject;
  runs: PlannedRun[];
  configDir: string;
  evidence?: BrowserEvidenceOptions & {
    writeStructuredEvidence?: (args: {
      run: PlannedRun;
      filename: string;
      data: unknown;
    }) => Promise<string>;
  };
  options: {
    headed?: boolean;
    navigationTimeoutMs?: number;
    noStartServer?: boolean;
    signal?: AbortSignal;
    progress?: ProgressReporter;
    runProgressOffset?: number;
    runProgressTotal?: number;
  };
}

export interface WebAuditBatchResult {
  runs: AuditRunResult[];
  diagnostics: Diagnostic[];
  serverManaged: boolean;
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

function sortRunsForExecution(runs: PlannedRun[]): PlannedRun[] {
  return [...runs].sort(
    (a, b) =>
      compareStrings(a.route?.path ?? "", b.route?.path ?? "") ||
      compareStrings(a.viewport?.name ?? "", b.viewport?.name ?? "") ||
      compareProfileOrder(a.profile, b.profile),
  );
}

function runKey(run: PlannedRun): string {
  return `${run.routeId ?? run.route?.path ?? "route"}::${run.viewport?.name ?? "default"}`;
}

function failedResult(
  project: ResolvedWebProject,
  run: PlannedRun,
  message: string,
  diagnostics: Diagnostic[] = [],
): AuditRunResult {
  return {
    runId: run.id,
    projectName: project.name,
    platform: project.platform,
    framework: project.framework,
    routeId: run.routeId,
    routeName: run.routeName,
    route: run.route?.path,
    url: run.baseUrl ?? project.baseUrl,
    profile: run.profile,
    viewport: run.viewport,
    status: "failed",
    startedAt: new Date().toISOString(),
    durationMs: 0,
    findings: [],
    diagnostics,
    skipReason: message,
    ...(run.adapter !== undefined ? { adapter: run.adapter } : {}),
  };
}

export async function runWebAudit(options: RunWebAuditOptions): Promise<WebAuditBatchResult> {
  const { project, runs, configDir } = options;
  const navigationTimeoutMs = options.options.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS;
  const diagnostics: Diagnostic[] = [];
  const sortedRuns = sortRunsForExecution(runs);

  if (sortedRuns.length === 0) {
    return { runs: [], diagnostics, serverManaged: false };
  }

  const rootDir = resolve(configDir, project.rootDir);
  const devServerManager = new DevServerManager();
  let serverManaged = false;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const readinessUrl = project.devServer?.url ?? project.baseUrl;
  const expectedOrigin = originOf(project.baseUrl);

  const progress = options.options.progress;
  const runProgressOffset = options.options.runProgressOffset ?? 0;
  const runProgressTotal = options.options.runProgressTotal ?? sortedRuns.length;

  try {
    try {
      progress?.start(`Waiting for ${readinessUrl}…`);
      const ensureResult = await devServerManager.ensureReady({
        rootDir,
        url: readinessUrl,
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
        runs: sortedRuns.map((run) => failedResult(project, run, `Dev server was not ready: ${message}`)),
        diagnostics,
        serverManaged: false,
      };
    }

    const readiness = mergeRunReadiness(project, configDir, navigationTimeoutMs);
    const readinessSelectors = [
      ...(readiness.selector ? [readiness.selector] : []),
      ...(readiness.recommendedSelectors ?? []),
    ];
    const baselines = new Map<string, ProfileSnapshot>();
    const hasDefaultForKey = new Set(
      sortedRuns.filter((run) => run.profile === "default").map((run) => runKey(run)),
    );
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
        runs: sortedRuns.map((run) => failedResult(project, run, `Browser failure: ${message}`)),
        diagnostics,
        serverManaged,
      };
    }

    const evidenceSink: ProfileEvidenceSink | undefined =
      options.evidence?.screenshots || options.evidence?.writeStructuredEvidence
        ? {
            writeStructuredEvidence: async ({ run, filename, data }) =>
              options.evidence?.writeStructuredEvidence?.({ run, filename, data }) ?? filename,
            writeRunScreenshot: options.evidence?.sink
              ? async ({ run, data }) => options.evidence!.sink!.writeRunScreenshot({ run, data })
              : undefined,
          }
        : undefined;

    for (const [runIndex, run] of sortedRuns.entries()) {
      if (options.options.signal?.aborted) {
        results.push(failedResult(project, run, "Audit was aborted before this run started."));
        continue;
      }

      const routeLabel = run.route?.path ?? run.routeId ?? "route";
      progress?.progress(
        runProgressOffset + runIndex + 1,
        runProgressTotal,
        `Auditing ${routeLabel} · ${run.profile} · ${run.viewport?.name ?? "default"}`,
      );

      const key = runKey(run);
      let baselineSnapshot = baselines.get(key);
      const needsBaseline =
        (run.profile === "large-text" || run.profile === "reduced-motion") &&
        !baselineSnapshot;

      if (needsBaseline && !hasDefaultForKey.has(key)) {
        const baselineRun: PlannedRun = { ...run, profile: "default", id: `${run.id}::internal-default` };
        let baselineUrl: string;
        try {
          baselineUrl = buildPageUrl(run.baseUrl ?? project.baseUrl, run.route?.path ?? "/");
        } catch (error) {
          results.push(
            failedResult(
              project,
              run,
              error instanceof Error ? error.message : String(error),
            ),
          );
          continue;
        }

        try {
          const baselineOutcome = await runProfileAudit({
            browser,
            url: baselineUrl,
            run: baselineRun,
            projectName: project.name,
            profileOptionsList: project.profileOptions,
            viewport: run.viewport,
            navigationTimeoutMs,
            readinessWaitUntil: readiness.waitUntil,
            readinessSelectors,
            signal: options.options.signal,
            internalBaseline: true,
            expectedOrigin,
            evidenceSink,
            captureScreenshots: false,
            normalizationContext: {
              projectName: project.name,
              routeId: run.routeId,
              routeName: run.routeName,
              route: run.route?.path,
              viewport: run.viewport?.name,
            },
          });
          baselineSnapshot = baselineOutcome.snapshot;
          baselines.set(key, baselineSnapshot!);
          diagnostics.push({
            code: "INTERNAL_DEFAULT_BASELINE",
            severity: "info",
            message: `Captured an internal default-profile reference for ${run.route?.path ?? "/"} (${run.viewport?.name ?? "default"}) before running "${run.profile}".`,
            path: `runs.${run.id}`,
          });
        } catch (error) {
          results.push(
            failedResult(
              project,
              run,
              `Could not capture internal default baseline: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
          continue;
        }
      }

      let url: string;
      try {
        url = buildPageUrl(run.baseUrl ?? project.baseUrl, run.route?.path ?? "/");
      } catch (error) {
        results.push(
          failedResult(project, run, error instanceof Error ? error.message : String(error)),
        );
        continue;
      }

      const startedAt = new Date();
      const startTime = Date.now();
      const evidenceOptions = options.evidence;
      const captureScreenshots = evidenceOptions?.screenshots ?? false;
      const evidenceSinkForRun = evidenceOptions?.sink;
      const enrichFindingEvidence =
        captureScreenshots && evidenceSinkForRun
          ? async ({
              page,
              run: activeRun,
              findings,
            }: {
              page: Page;
              run: PlannedRun;
              findings: Finding[];
            }) =>
              capturePageEvidence({
                page,
                run: activeRun,
                findings,
                options: {
                  screenshots: true,
                  fullPage: evidenceOptions?.fullPage ?? false,
                  sink: evidenceSinkForRun,
                },
              })
          : undefined;
      try {
        const outcome = await runProfileAudit({
          browser,
          url,
          run,
          projectName: project.name,
          profileOptionsList: project.profileOptions,
          viewport: run.viewport,
          navigationTimeoutMs,
          readinessWaitUntil: readiness.waitUntil,
          readinessSelectors,
          signal: options.options.signal,
          baselineSnapshot,
          expectedOrigin,
          evidenceSink,
          captureScreenshots: captureScreenshots && !enrichFindingEvidence,
          enrichFindingEvidence,
          normalizationContext: {
            projectName: project.name,
            routeId: run.routeId,
            routeName: run.routeName,
            route: run.route?.path,
            viewport: run.viewport?.name,
          },
        });

        if (run.profile === "default" && outcome.snapshot) {
          baselines.set(key, outcome.snapshot);
        }

        results.push({
          runId: run.id,
          projectName: project.name,
          platform: project.platform,
          framework: project.framework,
          routeId: run.routeId,
          routeName: run.routeName,
          route: run.route?.path,
          url: outcome.url,
          profile: run.profile,
          viewport: run.viewport,
          status: "completed",
          startedAt: startedAt.toISOString(),
          durationMs: Date.now() - startTime,
          findings: sortFindings(outcome.findings),
          diagnostics: outcome.diagnostics,
          coverage: outcome.coverage,
          profileMetadata: outcome.profileMetadata,
          profileEvidence: outcome.evidence,
          ...(run.adapter !== undefined ? { adapter: run.adapter } : {}),
          evidence: {
            screenshot: outcome.screenshot,
            documentTitle: outcome.documentTitle,
            finalUrl: outcome.url,
            httpStatus: outcome.statusCode,
            capturedAt: outcome.capturedAt,
            navigationDurationMs: outcome.navigationDurationMs,
            viewport: normalizeViewport(run.viewport),
          },
        });
      } catch (error) {
        if (error instanceof TargetOriginMismatchError) {
          results.push(
            failedResult(project, run, error.message, [targetOriginMismatchDiagnostic(error)]),
          );
          continue;
        }
        results.push(
          failedResult(
            project,
            run,
            error instanceof Error ? error.message : String(error),
            [
              {
                code: "PROFILE_EXECUTION_FAILED",
                severity: "error",
                message: error instanceof Error ? error.message : String(error),
                path: `runs.${run.id}`,
              },
            ],
          ),
        );
      }
    }

    return { runs: results, diagnostics, serverManaged };
  } finally {
    await browser?.close().catch(() => undefined);
    await devServerManager.stop();
  }
}
