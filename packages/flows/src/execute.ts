import type {
  AccessibilityProfile,
  Diagnostic,
  Finding,
  FlowCheckpointResult,
  FlowStepResult,
  FlowTrace,
  NormalizedFlow,
  NormalizedViewport,
  RunProfileCoverage,
  RunStructuredEvidenceRef,
} from "@a11yst/types";
import type { Browser, BrowserContextOptions, Page } from "playwright";
import { buildFlowSessionId } from "./ids.js";
import { executeFlowStep, FlowStepExecutionError, maskStepForTrace } from "./steps.js";

export interface FlowEvidenceSink {
  writeFlowTrace(args: {
    flowId: string;
    profile: AccessibilityProfile;
    viewportName: string;
    data: FlowTrace;
  }): Promise<string>;
  writeStepScreenshot?(args: {
    flowId: string;
    profile: AccessibilityProfile;
    viewportName: string;
    stepIndex: number;
    action: string;
    data: Buffer;
  }): Promise<string>;
  writeCheckpointScreenshot?(args: {
    flowId: string;
    checkpointId: string;
    profile: AccessibilityProfile;
    viewportName: string;
    data: Buffer;
  }): Promise<string>;
}

export interface CheckpointAuditRequest {
  checkpointId: string;
  checkpointName: string;
  stepIndex: number;
  page: Page;
  url: string;
  documentTitle?: string;
}

export interface CheckpointAuditOutcome {
  findings: Finding[];
  diagnostics: Diagnostic[];
  screenshot?: string;
  profileEvidence?: RunStructuredEvidenceRef[];
  coverage?: RunProfileCoverage;
  profileMetadata?: Record<string, unknown>;
}

export type CheckpointAuditor = (
  request: CheckpointAuditRequest,
) => Promise<CheckpointAuditOutcome>;

export interface FlowSessionParams {
  browser: Browser;
  flow: NormalizedFlow;
  projectName: string;
  profile: AccessibilityProfile;
  viewport: NormalizedViewport;
  baseOrigin: string;
  baseUrl: string;
  startPath: string;
  contextOptions?: BrowserContextOptions;
  storageState?: string;
  stepTimeout?: number;
  navigationTimeout?: number;
  signal?: AbortSignal;
  auditCheckpoint: CheckpointAuditor;
  evidenceSink?: FlowEvidenceSink;
  evaluateFlowRules?: (
    page: Page,
    steps: FlowStepResult[],
    checkpointId: string,
  ) => Promise<Finding[]>;
}

export interface FlowSessionResult {
  sessionId: string;
  status: "completed" | "failed";
  steps: FlowStepResult[];
  checkpoints: FlowCheckpointResult[];
  diagnostics: Diagnostic[];
  findings: Finding[];
  tracePath?: string;
  durationMs: number;
}

function buildContextOptions(
  viewport: NormalizedViewport,
  profile: AccessibilityProfile,
  extra?: BrowserContextOptions,
): BrowserContextOptions {
  const base: BrowserContextOptions = {
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
  };
  if (profile === "reduced-motion") {
    base.reducedMotion = "reduce";
  }
  return { ...base, ...extra };
}

export async function executeFlowSession(params: FlowSessionParams): Promise<FlowSessionResult> {
  const startedAt = new Date();
  const sessionId = buildFlowSessionId({
    projectName: params.projectName,
    flowId: params.flow.id,
    profile: params.profile,
    viewportName: params.viewport.name,
  });
  const stepTimeout = params.stepTimeout ?? params.flow.stepTimeout;
  const navigationTimeout = params.navigationTimeout ?? params.flow.navigationTimeout;
  const allowedOrigins = params.flow.allowOrigins;
  const steps: FlowStepResult[] = [];
  const checkpoints: FlowCheckpointResult[] = [];
  const diagnostics: Diagnostic[] = [];
  const findings: Finding[] = [];
  let flowFailed = false;
  let failureMessage: string | undefined;

  const context = await params.browser.newContext(
    buildContextOptions(params.viewport, params.profile, {
      ...(params.storageState ? { storageState: params.storageState } : {}),
      ...params.contextOptions,
    }),
  );
  const page = await context.newPage();

  try {
    const startUrl = new URL(params.startPath, params.baseUrl).toString();
    await page.goto(startUrl, {
      waitUntil: "domcontentloaded",
      timeout: navigationTimeout,
    });

    for (const step of params.flow.steps) {
      if (params.signal?.aborted) {
        throw new FlowStepExecutionError("Flow session was aborted.");
      }
      if (flowFailed && step.action !== "checkpoint") {
        steps.push({
          index: step.index,
          action: step.action,
          status: "skipped",
          startedAt: new Date().toISOString(),
          durationMs: 0,
          diagnostics: [
            {
              code: "FLOW_STEP_SKIPPED",
              severity: "info",
              message: "Step skipped because a previous step failed.",
            },
          ],
        });
        continue;
      }

      const stepStarted = Date.now();
      const outcome = await executeFlowStep({
        page,
        step,
        baseOrigin: params.baseOrigin,
        allowedOrigins,
        stepTimeout,
        navigationTimeout,
      });

      let evidence: string[] | undefined;
      if (
        params.evidenceSink?.writeStepScreenshot &&
        outcome.status === "failed" &&
        step.action !== "checkpoint"
      ) {
        try {
          const data = await page.screenshot({ animations: "disabled" });
          const path = await params.evidenceSink.writeStepScreenshot({
            flowId: params.flow.id,
            profile: params.profile,
            viewportName: params.viewport.name,
            stepIndex: step.index,
            action: step.action,
            data,
          });
          evidence = [path];
        } catch {
          // optional
        }
      }

      steps.push({
        index: step.index,
        startedAt: new Date(stepStarted).toISOString(),
        durationMs: Date.now() - stepStarted,
        ...outcome,
        ...(evidence ? { evidence } : {}),
      });

      if (outcome.status === "failed") {
        flowFailed = true;
        failureMessage = outcome.failureReason ?? "Flow step failed.";
        diagnostics.push({
          code: "FLOW_STEP_FAILED",
          severity: "error",
          message: `Step ${step.index + 1} (${step.action}) failed: ${failureMessage}`,
        });
        if (step.action === "checkpoint") {
          checkpoints.push({
            checkpointId: step.id,
            checkpointName: step.name ?? step.id,
            stepIndex: step.index,
            status: "skipped",
            diagnostics: [
              {
                code: "FLOW_CHECKPOINT_SKIPPED",
                severity: "warning",
                message: "Checkpoint skipped because its step failed.",
              },
            ],
          });
        }
        continue;
      }

      if (step.action === "checkpoint") {
        const checkpointStarted = Date.now();
        let documentTitle: string | undefined;
        try {
          documentTitle = await page.title();
        } catch {
          documentTitle = undefined;
        }

        const auditOutcome = await params.auditCheckpoint({
          checkpointId: step.id,
          checkpointName: step.name ?? step.id,
          stepIndex: step.index,
          page,
          url: page.url(),
          documentTitle,
        });
        findings.push(...auditOutcome.findings);
        diagnostics.push(...auditOutcome.diagnostics);

        if (params.evaluateFlowRules) {
          findings.push(...(await params.evaluateFlowRules(page, steps, step.id)));
        }

        checkpoints.push({
          checkpointId: step.id,
          checkpointName: step.name ?? step.id,
          stepIndex: step.index,
          status: "completed",
          startedAt: new Date(checkpointStarted).toISOString(),
          durationMs: Date.now() - checkpointStarted,
          url: page.url(),
          documentTitle,
          diagnostics: auditOutcome.diagnostics,
          ...(auditOutcome.screenshot ? { evidence: [auditOutcome.screenshot] } : {}),
        });
      }
    }

    // Mark remaining checkpoints skipped if flow failed mid-way
    for (const step of params.flow.steps) {
      if (step.action !== "checkpoint") continue;
      const existing = checkpoints.find((item) => item.checkpointId === step.id);
      if (existing) continue;
      if (flowFailed) {
        checkpoints.push({
          checkpointId: step.id,
          checkpointName: step.name ?? step.id,
          stepIndex: step.index,
          status: "skipped",
          diagnostics: [
            {
              code: "FLOW_CHECKPOINT_SKIPPED",
              severity: "warning",
              message: failureMessage ?? "Checkpoint skipped because the flow failed earlier.",
            },
          ],
        });
      }
    }
  } catch (error) {
    flowFailed = true;
    diagnostics.push({
      code: "FLOW_SESSION_FAILED",
      severity: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }

  const durationMs = Date.now() - startedAt.getTime();
  const trace: FlowTrace = {
    schemaVersion: "1",
    projectName: params.projectName,
    flowId: params.flow.id,
    flowName: params.flow.name,
    profile: params.profile,
    viewport: params.viewport.name,
    sessionId,
    startedAt: startedAt.toISOString(),
    durationMs,
    status: flowFailed ? "failed" : "completed",
    steps: steps.map((step, index) => ({
      ...step,
      ...(params.flow.steps[index] ? {} : {}),
    })),
    checkpoints,
    diagnostics,
  };

  let tracePath: string | undefined;
  if (params.evidenceSink) {
    tracePath = await params.evidenceSink.writeFlowTrace({
      flowId: params.flow.id,
      profile: params.profile,
      viewportName: params.viewport.name,
      data: {
        ...trace,
        steps: steps.map((result, index) => {
          const masked = maskStepForTrace(params.flow.steps[index]!);
          if (masked.action === "fill" && masked.sensitive) {
            return { ...result, failureReason: result.failureReason };
          }
          return result;
        }),
      },
    });
  }

  return {
    sessionId,
    status: flowFailed ? "failed" : "completed",
    steps,
    checkpoints,
    diagnostics,
    findings,
    ...(tracePath ? { tracePath } : {}),
    durationMs,
  };
}
