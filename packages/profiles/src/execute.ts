import { AxeBuilder } from "@axe-core/playwright";
import type { Browser, BrowserContextOptions, Page } from "playwright";
import type {
  Diagnostic,
  NormalizedProfileOptions,
  NormalizedViewport,
  PlannedRun,
  ProfileEvidence,
  ProfileFinding,
  ProfileSnapshot,
  RunProfileCoverage,
  ViewportConfig,
} from "@a11yst/types";
import { mapAxeImpactToSeverity, normalizeAxeImpact } from "@a11yst/types";
import {
  evaluateKeyboardRules,
  evaluateLargeTextRules,
  evaluateReducedMotionRules,
  listRuleMetadata,
} from "@a11yst/rules";
import { PROFILE_COVERAGE, PROFILE_VERSION } from "./order.js";
import { resolveProfileOptions } from "./registry.js";
import {
  collectInteractiveInventory,
  collectLayoutElements,
  collectMotionRecords,
  detectSmoothScroll,
  injectTextScale,
  readMatchMediaReduce,
  readPageDimensions,
  removeTextScale,
} from "./dom.js";
import { traverseKeyboard } from "./keyboard-traverse.js";
import {
  assertConfiguredTargetOrigin,
} from "./target-origin.js";

export interface ProfileEvidenceSink {
  writeStructuredEvidence(args: {
    run: PlannedRun;
    filename: string;
    data: unknown;
  }): Promise<string>;
  writeRunScreenshot?(args: { run: PlannedRun; data: Buffer; suffix?: string }): Promise<string>;
}

export interface ProfileAuditParams {
  browser: Browser;
  url: string;
  run: PlannedRun;
  projectName: string;
  profileOptionsList: NormalizedProfileOptions[];
  viewport?: ViewportConfig;
  navigationTimeoutMs: number;
  readinessWaitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  readinessSelectors?: string[];
  readinessSettleMs?: number;
  signal?: AbortSignal;
  baselineSnapshot?: ProfileSnapshot;
  internalBaseline?: boolean;
  evidenceSink?: ProfileEvidenceSink;
  captureScreenshots?: boolean;
  enrichFindingEvidence?: (args: {
    page: Page;
    run: PlannedRun;
    findings: ProfileFinding[];
  }) => Promise<{ screenshot?: string; diagnostics: Diagnostic[] }>;
  normalizationContext: {
    projectName: string;
    routeId?: string;
    routeName?: string;
    route?: string;
    viewport?: string;
  };
  /** When set, navigation must remain on this origin or the audit fails. */
  expectedOrigin?: string;
}

export interface ProfileAuditOutcome {
  url: string;
  statusCode?: number;
  documentTitle?: string;
  capturedAt: string;
  navigationDurationMs: number;
  screenshot?: string;
  findings: ProfileFinding[];
  diagnostics: Diagnostic[];
  coverage: RunProfileCoverage;
  snapshot?: ProfileSnapshot;
  profileMetadata: Record<string, unknown>;
  evidence: ProfileEvidence[];
  internalBaseline?: boolean;
}

function normalizeViewport(viewport?: ViewportConfig): NormalizedViewport {
  return {
    name: viewport?.name ?? "default",
    width: viewport?.width ?? 1280,
    height: viewport?.height ?? 800,
    deviceScaleFactor: viewport?.deviceScaleFactor ?? 1,
    isMobile: viewport?.isMobile ?? false,
    hasTouch: viewport?.hasTouch ?? false,
    orientation: viewport?.orientation ?? "landscape",
  };
}

function buildContextOptions(
  profile: PlannedRun["profile"],
  viewport?: ViewportConfig,
): BrowserContextOptions {
  const normalized = normalizeViewport(viewport);
  return {
    viewport: { width: normalized.width, height: normalized.height },
    deviceScaleFactor: normalized.deviceScaleFactor,
    isMobile: normalized.isMobile,
    hasTouch: normalized.hasTouch,
    locale: "en-US",
    timezoneId: "UTC",
    serviceWorkers: "block",
    ...(profile === "reduced-motion"
      ? { reducedMotion: "reduce" as const }
      : {}),
  };
}

function axeFindings(
  violations: unknown[],
  context: ProfileAuditParams["normalizationContext"] & {
    profile: PlannedRun["profile"];
    url: string;
    flowId?: string;
    checkpointId?: string;
  },
): ProfileFinding[] {
  // Minimal inline normalization to avoid circular import with browser package.
  return (violations as Array<{
    id: string;
    impact?: string | null;
    help?: string;
    description?: string;
    helpUrl?: string;
    tags?: readonly string[];
    nodes?: Array<{ target?: ReadonlyArray<string | readonly string[]>; html?: string; failureSummary?: string }>;
  }>).flatMap((violation) => {
    const severity = mapAxeImpactToSeverity(violation.impact);
    const sourceImpact = normalizeAxeImpact(violation.impact);
    return (violation.nodes ?? []).map((node, nodeIndex) => {
      const target = (node.target ?? []).map((entry) =>
        Array.isArray(entry) ? entry.join(" >> ") : String(entry),
      );
      const targetKey = target.join("|") || "document";
      const fingerprint = context.flowId
        ? [
            violation.id,
            context.projectName,
            context.flowId,
            context.checkpointId ?? "",
            context.profile,
            context.viewport ?? "",
            targetKey,
          ].join("::")
        : [
            violation.id,
            context.projectName,
            context.route ?? "",
            context.profile,
            context.viewport ?? "",
            target.join(","),
          ].join("|");
      const idSegments = context.flowId
        ? [
            violation.id,
            context.projectName,
            context.flowId,
            context.checkpointId ?? "no-checkpoint",
            context.profile,
            context.viewport ?? "no-viewport",
            target[0] ?? "no-target",
          ]
        : [
            violation.id,
            context.projectName,
            context.route ?? "no-route",
            context.profile,
            context.viewport ?? "no-viewport",
            target[0] ?? "no-target",
          ];
      const id = `${idSegments.join("::")}::${nodeIndex}`;
      return {
        id,
        fingerprint,
        fingerprintVersion: "1" as const,
        source: "axe" as const,
        ruleId: violation.id,
        title: violation.help ?? violation.id,
        description: violation.description,
        severity,
        sourceImpact,
        projectName: context.projectName,
        profile: context.profile,
        routeId: context.routeId,
        routeName: context.routeName,
        route: context.route,
        url: context.url,
        viewport: context.viewport,
        target,
        html: node.html,
        failureSummary: node.failureSummary,
        helpUrl: violation.helpUrl,
        standards: (violation.tags ?? []).filter((tag) => tag.startsWith("wcag")),
        confidence: "high" as const,
        automation: "automated" as const,
        ...(context.flowId ? { flowId: context.flowId } : {}),
        ...(context.checkpointId ? { checkpointId: context.checkpointId } : {}),
      } satisfies ProfileFinding;
    });
  });
}

async function applyReadiness(page: Page, params: ProfileAuditParams): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  if (params.readinessSelectors) {
    for (const selector of params.readinessSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: params.navigationTimeoutMs });
      } catch {
        diagnostics.push({
          code: "READINESS_SELECTOR_TIMEOUT",
          severity: "warning",
          message: `Readiness selector "${selector}" was not found before timeout.`,
          path: `runs.${params.run.id}`,
        });
      }
    }
  }
  if (params.readinessSettleMs && params.readinessSettleMs > 0) {
    await page.waitForTimeout(params.readinessSettleMs);
  }
  return diagnostics;
}

export interface AuditPageWithProfileParams {
  page: Page;
  run: PlannedRun;
  projectName: string;
  profileOptionsList: NormalizedProfileOptions[];
  viewport?: ViewportConfig;
  baselineSnapshot?: ProfileSnapshot;
  internalBaseline?: boolean;
  /** Capture snapshot only — no axe, rules, or findings (internal default reference). */
  baselineOnly?: boolean;
  evidenceSink?: ProfileEvidenceSink;
  captureScreenshots?: boolean;
  enrichFindingEvidence?: ProfileAuditParams["enrichFindingEvidence"];
  normalizationContext: ProfileAuditParams["normalizationContext"];
  flowId?: string;
  checkpointId?: string;
}

/** Capture layout and motion state at a checkpoint without running axe or a11yst rules. */
export async function captureCheckpointBaseline(page: Page): Promise<ProfileSnapshot> {
  const url = page.url();
  const dimensions = await readPageDimensions(page);
  const motionRecords = await collectMotionRecords(page);
  const elements = await collectLayoutElements(page);
  return {
    profile: "default",
    url,
    capturedAt: new Date().toISOString(),
    ...dimensions,
    motionRecords,
    elementSnapshots: elements.map((element) => ({
      target: element.target,
      boundingBox: element.boundingBox,
      visible: element.visible,
      ...(element.text ? { text: element.text } : {}),
    })),
  };
}

async function performProfileAuditOnPage(
  page: Page,
  params: AuditPageWithProfileParams,
  startedAt: number,
): Promise<ProfileAuditOutcome> {
  const profile = params.run.profile;
  const options = resolveProfileOptions(params.profileOptionsList, profile);
  const coverageBase = PROFILE_COVERAGE[profile];
  const ruleContext = {
    projectName: params.projectName,
    profile,
    routeId: params.normalizationContext.routeId,
    routeName: params.normalizationContext.routeName,
    route: params.normalizationContext.route,
    viewport: params.normalizationContext.viewport,
    flowId: params.flowId,
    checkpointId: params.checkpointId,
  };

  const evidence: ProfileEvidence[] = [];
  const diagnostics: Diagnostic[] = [];
  let findings: ProfileFinding[] = [];
  let screenshot: string | undefined;

  const url = page.url();
  const dimensions = await readPageDimensions(page);
  const motionRecords =
    profile === "default" || profile === "reduced-motion"
      ? await collectMotionRecords(page)
      : undefined;

  if (params.captureScreenshots && params.evidenceSink?.writeRunScreenshot) {
    const data = await page.screenshot({ animations: "disabled" });
    screenshot = await params.evidenceSink.writeRunScreenshot({
      run: params.run,
      data,
      suffix: profile,
    });
  }

  const snapshot: ProfileSnapshot = {
    profile,
    url,
    capturedAt: new Date().toISOString(),
    screenshot,
    ...dimensions,
    motionRecords,
  };

  if (params.baselineOnly) {
    const elements = await collectLayoutElements(page);
    return {
      url,
      documentTitle: await page.title().catch(() => undefined),
      capturedAt: snapshot.capturedAt,
      navigationDurationMs: Date.now() - startedAt,
      findings: [],
      diagnostics,
      coverage: {
        profile: "default",
        status: "completed",
        automatedChecks: [],
        heuristicChecks: [],
        manualChecks: [],
        limitations: ["Internal default reference snapshot only."],
        a11ystRulesExecuted: [],
        axeExecuted: false,
      },
      snapshot: {
        ...snapshot,
        elementSnapshots: elements.map((element) => ({
          target: element.target,
          boundingBox: element.boundingBox,
          visible: element.visible,
          ...(element.text ? { text: element.text } : {}),
        })),
      },
      profileMetadata: {
        profileVersion: PROFILE_VERSION,
        internalReferenceProfile: "default",
        internalBaselineUsed: true,
      },
      evidence: [],
      internalBaseline: true,
    };
  }

  const axeContext = {
    ...params.normalizationContext,
    profile,
    url,
    ...(params.flowId ? { flowId: params.flowId } : {}),
    ...(params.checkpointId ? { checkpointId: params.checkpointId } : {}),
  };
  const axeResults = await new AxeBuilder({ page }).analyze();
  findings.push(...axeFindings(axeResults.violations as unknown[], axeContext));

  if (profile === "keyboard" && options.id === "keyboard") {
    const inventory = await collectInteractiveInventory(page);
    const traversal = await traverseKeyboard(page, inventory, {
      maxTabStops: options.maxTabStops,
      viewportWidth: params.viewport?.width ?? 1280,
      viewportHeight: params.viewport?.height ?? 800,
    });
    findings.push(...evaluateKeyboardRules(traversal, { ...ruleContext, url }, options));
    if (params.evidenceSink) {
      const path = await params.evidenceSink.writeStructuredEvidence({
        run: params.run,
        filename: "focus-sequence.json",
        data: traversal,
      });
      evidence.push({ kind: "focus-sequence", path, data: { stepCount: traversal.forwardSteps.length } });
    }
  }

  if (profile === "large-text" && options.id === "large-text") {
    const baselineElements = await collectLayoutElements(page);
    await injectTextScale(page, options.textScale);
    await page.waitForTimeout(100);
    const scaledElements = await collectLayoutElements(page);
    const scaledDimensions = await readPageDimensions(page);
    const scaledSnapshot: ProfileSnapshot = {
      profile: "large-text",
      url,
      capturedAt: new Date().toISOString(),
      ...scaledDimensions,
    };
    if (options.compareWithDefault) {
      findings.push(
        ...evaluateLargeTextRules(
          {
            baseline: params.baselineSnapshot,
            scaled: scaledSnapshot,
            elements: baselineElements,
            scaledElements,
            tolerancePx: options.overlapTolerancePx,
            overlapTolerancePercent: 20,
          },
          { ...ruleContext, url },
        ),
      );
    }
    if (params.evidenceSink) {
      const path = await params.evidenceSink.writeStructuredEvidence({
        run: params.run,
        filename: "layout-comparison.json",
        data: { baseline: params.baselineSnapshot, scaled: scaledSnapshot },
      });
      evidence.push({ kind: "layout-comparison", path });
    }
    await removeTextScale(page);
  }

  if (profile === "reduced-motion" && options.id === "reduced-motion") {
    const matchMediaReduce = await readMatchMediaReduce(page);
    const reducedRecords = await collectMotionRecords(page);
    const smoothScrollDetected = await detectSmoothScroll(page);
    findings.push(
      ...evaluateReducedMotionRules(
        {
          matchMediaReduce,
          reducedRecords,
          baselineRecords: params.baselineSnapshot?.motionRecords,
          smoothScrollDetected,
          minimumSignificantDurationMs: options.minimumSignificantDurationMs,
        },
        { ...ruleContext, url },
      ),
    );
    if (params.evidenceSink) {
      const path = await params.evidenceSink.writeStructuredEvidence({
        run: params.run,
        filename: "motion-comparison.json",
        data: {
          reduced: reducedRecords,
          baseline: params.baselineSnapshot?.motionRecords ?? [],
        },
      });
      evidence.push({ kind: "motion-comparison", path });
    }
  }

  if (params.enrichFindingEvidence) {
    const enriched = await params.enrichFindingEvidence({
      page,
      run: params.run,
      findings,
    });
    if (enriched.screenshot) {
      screenshot = enriched.screenshot;
    }
    diagnostics.push(...enriched.diagnostics);
  }

  findings = findings.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));

  const a11ystRulesExecuted = listRuleMetadata()
    .filter((rule) => rule.profile === profile)
    .map((rule) => rule.id);

  return {
    url,
    documentTitle: await page.title().catch(() => undefined),
    capturedAt: new Date().toISOString(),
    navigationDurationMs: Date.now() - startedAt,
    screenshot,
    findings,
    diagnostics,
    coverage: {
      profile,
      status: "completed",
      ...coverageBase,
      a11ystRulesExecuted,
      axeExecuted: true,
    },
    snapshot,
    profileMetadata: {
      profileVersion: PROFILE_VERSION,
      ...(params.internalBaseline ? { internalBaselineUsed: true } : {}),
      ...(profile === "large-text" && options.id === "large-text"
        ? { strategy: "injected-text-scale", scale: options.textScale }
        : {}),
    },
    evidence,
    ...(params.internalBaseline ? { internalBaseline: true } : {}),
  };
}

/** Audit the current page state with a profile — no navigation or new browser context. */
export async function auditPageWithProfile(
  params: AuditPageWithProfileParams,
): Promise<ProfileAuditOutcome> {
  const startedAt = Date.now();
  return performProfileAuditOnPage(params.page, params, startedAt);
}

export async function runProfileAudit(params: ProfileAuditParams): Promise<ProfileAuditOutcome> {
  const context = await params.browser.newContext(buildContextOptions(params.run.profile, params.viewport));
  const page = await context.newPage();
  const startedNavigation = Date.now();
  const diagnostics: Diagnostic[] = [];

  try {
    const response = await page.goto(params.url, {
      waitUntil: params.readinessWaitUntil ?? "domcontentloaded",
      timeout: params.navigationTimeoutMs,
    });
    diagnostics.push(...(await applyReadiness(page, params)));

    if (params.expectedOrigin) {
      assertConfiguredTargetOrigin({
        configuredTargetUrl: `${params.expectedOrigin}/`,
        actualPageUrl: page.url(),
        route: params.normalizationContext.route ?? "/",
      });
    }

    const outcome = await performProfileAuditOnPage(
      page,
      {
        page,
        run: params.run,
        projectName: params.projectName,
        profileOptionsList: params.profileOptionsList,
        viewport: params.viewport,
        baselineSnapshot: params.baselineSnapshot,
        internalBaseline: params.internalBaseline,
        evidenceSink: params.evidenceSink,
        captureScreenshots: params.captureScreenshots,
        enrichFindingEvidence: params.enrichFindingEvidence,
        normalizationContext: params.normalizationContext,
      },
      startedNavigation,
    );

    return {
      ...outcome,
      statusCode: response?.status(),
      diagnostics: [...diagnostics, ...outcome.diagnostics],
    };
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

export async function captureDefaultBaselineSnapshot(
  params: Omit<ProfileAuditParams, "run"> & { run: PlannedRun },
): Promise<ProfileSnapshot | undefined> {
  const baselineRun: PlannedRun = { ...params.run, profile: "default" };
  const outcome = await runProfileAudit({
    ...params,
    run: baselineRun,
    internalBaseline: true,
  });
  return outcome.snapshot;
}
