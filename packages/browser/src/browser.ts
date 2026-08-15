import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import type {
  Diagnostic,
  Finding,
  NormalizedViewport,
  PlannedRun,
  ViewportConfig,
} from "@a11yst/types";
import {
  normalizeAxeViolations,
  type AxeNormalizationContext,
  type AxeViolationLike,
} from "./axe-normalize.js";
import { applyPageReadiness, ReadinessError, type MergedReadinessConfig } from "./readiness.js";

const DEFAULT_VIEWPORT: NormalizedViewport = {
  name: "default",
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
  orientation: "landscape",
};
const MAX_FULL_PAGE_HEIGHT = 12_000;

export interface EvidenceSink {
  writeRunScreenshot(args: { run: PlannedRun; data: Buffer }): Promise<string>;
  writeFindingScreenshot(args: {
    run: PlannedRun;
    finding: Finding;
    targetIndex: number;
    data: Buffer;
  }): Promise<string>;
}

export interface BrowserEvidenceOptions {
  screenshots: boolean;
  fullPage: boolean;
  sink?: EvidenceSink;
}

export interface BrowserSessionOptions {
  /** Run with a visible browser window instead of headless. */
  headed?: boolean;
  signal?: AbortSignal;
}

/** Distinguishable failure categories for a single page audit. */
export type BrowserErrorKind =
  | "connection-refused"
  | "timeout"
  | "http-error"
  | "axe-failure"
  | "browser-closed"
  | "aborted"
  | "navigation-error";

export class BrowserAuditError extends Error {
  readonly kind: BrowserErrorKind;
  readonly statusCode?: number;

  constructor(
    kind: BrowserErrorKind,
    message: string,
    options: { statusCode?: number; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "BrowserAuditError";
    this.kind = kind;
    this.statusCode = options.statusCode;
  }
}

export interface PageAuditParams {
  url: string;
  viewport?: ViewportConfig;
  navigationTimeoutMs: number;
  signal?: AbortSignal;
  /** Planned run used only for sink callbacks; never retained in the outcome. */
  run?: PlannedRun;
  /** Enables in-page normalization and finding evidence capture. */
  normalizationContext?: AxeNormalizationContext;
  evidence?: BrowserEvidenceOptions;
  readiness?: MergedReadinessConfig;
}

export interface PageAuditOutcome {
  /** Final URL after any redirects. */
  url: string;
  statusCode?: number;
  documentTitle?: string;
  capturedAt: string;
  navigationDurationMs: number;
  screenshot?: string;
  violations: AxeViolationLike[];
  findings?: Finding[];
  diagnostics: Diagnostic[];
}

/**
 * A single Chromium browser instance shared across the runs of one web
 * project. Each `auditPage` call gets its own isolated context/page.
 */
export interface BrowserSession {
  auditPage(params: PageAuditParams): Promise<PageAuditOutcome>;
}

export function normalizeViewport(viewport?: ViewportConfig): NormalizedViewport {
  if (!viewport) {
    return { ...DEFAULT_VIEWPORT };
  }
  return {
    name: viewport.name,
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
    isMobile: viewport.isMobile ?? false,
    hasTouch: viewport.hasTouch ?? false,
    orientation:
      viewport.orientation ?? (viewport.width >= viewport.height ? "landscape" : "portrait"),
  };
}

/** Build deterministic, isolated Playwright context options for a viewport. */
export function buildContextOptions(viewport?: ViewportConfig): BrowserContextOptions {
  const normalized = normalizeViewport(viewport);
  const shortSide = Math.min(normalized.width, normalized.height);
  const longSide = Math.max(normalized.width, normalized.height);
  const screen =
    normalized.orientation === "portrait"
      ? { width: shortSide, height: longSide }
      : { width: longSide, height: shortSide };
  return {
    viewport: { width: normalized.width, height: normalized.height },
    screen,
    deviceScaleFactor: normalized.deviceScaleFactor,
    isMobile: normalized.isMobile,
    hasTouch: normalized.hasTouch,
    locale: "en-US",
    timezoneId: "UTC",
    serviceWorkers: "block",
  };
}

/**
 * Launch Chromium once, hand callers a `BrowserSession` to run audits with,
 * and guarantee the browser is closed afterwards (success, error, or abort).
 */
export async function withBrowser<T>(
  options: BrowserSessionOptions,
  fn: (session: BrowserSession) => Promise<T>,
): Promise<T> {
  if (options.signal?.aborted) {
    throw new BrowserAuditError("aborted", "Audit was aborted before the browser could be launched.");
  }

  let browser: Browser;
  try {
    browser = await chromium.launch({
      channel: "chromium",
      headless: !options.headed,
    });
  } catch (error) {
    throw new BrowserAuditError(
      "browser-closed",
      `Failed to launch Chromium: ${(error as Error).message}`,
      { cause: error },
    );
  }

  const onAbort = () => {
    void browser.close().catch(() => {
      // Best-effort: browser may already be closing.
    });
  };
  options.signal?.addEventListener("abort", onAbort);

  const session: BrowserSession = {
    auditPage: (params) => auditPageWithBrowser(browser, params),
  };

  try {
    return await fn(session);
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
    await browser.close().catch(() => {
      // Already closed (e.g. via abort) — nothing more to do.
    });
  }
}

async function auditPageWithBrowser(
  browser: Browser,
  params: PageAuditParams,
): Promise<PageAuditOutcome> {
  if (params.signal?.aborted) {
    throw new BrowserAuditError("aborted", `Audit run for ${params.url} was aborted before it started.`);
  }
  if (!browser.isConnected()) {
    throw new BrowserAuditError(
      "browser-closed",
      `Browser connection was already closed before ${params.url} could be audited.`,
    );
  }

  let context: BrowserContext;
  try {
    context = await browser.newContext(buildContextOptions(params.viewport));
  } catch (error) {
    throw new BrowserAuditError(
      "browser-closed",
      `Failed to create an isolated browser context for ${params.url}: ${(error as Error).message}`,
      { cause: error },
    );
  }

  let page: Page | undefined;
  try {
    page = await context.newPage();

    let response;
    const navigationStartedAt = Date.now();
    try {
      response = await page.goto(params.url, {
        waitUntil: params.readiness?.waitUntil ?? "domcontentloaded",
        timeout: params.navigationTimeoutMs,
      });
    } catch (error) {
      throw classifyNavigationError(error, params.url);
    }
    const navigationDurationMs = Date.now() - navigationStartedAt;

    if (params.signal?.aborted) {
      throw new BrowserAuditError("aborted", `Audit run for ${params.url} was aborted after navigation.`);
    }

    const statusCode = response?.status();
    if (statusCode !== undefined && statusCode >= 400) {
      throw new BrowserAuditError(
        "http-error",
        `Received HTTP ${statusCode} while navigating to ${params.url}.`,
        { statusCode },
      );
    }

    const diagnostics: Diagnostic[] = [];
    try {
      diagnostics.push(
        ...(await applyPageReadiness(page, {
          readiness: params.readiness,
          navigationTimeoutMs: params.navigationTimeoutMs,
          run: params.run,
        })),
      );
    } catch (error) {
      if (error instanceof ReadinessError) {
        throw new BrowserAuditError("timeout", error.message);
      }
      throw error;
    }

    let axeResults;
    try {
      axeResults = await new AxeBuilder({ page }).analyze();
    } catch (error) {
      throw new BrowserAuditError(
        "axe-failure",
        `axe-core failed to analyze ${params.url}: ${(error as Error).message}`,
        { cause: error },
      );
    }

    const violations = axeResults.violations as unknown as AxeViolationLike[];
    const findings = params.normalizationContext
      ? normalizeAxeViolations(violations, {
          ...params.normalizationContext,
          url: page.url(),
        })
      : undefined;
    let screenshot: string | undefined;

    if (params.evidence && params.run && findings) {
      const captured = await capturePageEvidence({
        page,
        run: params.run,
        findings,
        options: params.evidence,
      });
      screenshot = captured.screenshot;
      diagnostics.push(...captured.diagnostics);
    }

    let documentTitle: string | undefined;
    try {
      documentTitle = await page.title();
    } catch {
      // The page can disappear after axe has completed. Metadata is optional.
    }

    return {
      url: page.url(),
      statusCode,
      documentTitle,
      capturedAt: new Date().toISOString(),
      navigationDurationMs,
      screenshot,
      violations,
      findings,
      diagnostics,
    };
  } finally {
    await page?.close().catch(() => {
      // Page may already be gone if navigation/browser failed hard.
    });
    await context.close().catch(() => {
      // Context may already be gone for the same reason.
    });
  }
}

interface CapturePageEvidenceArgs {
  page: Page;
  run: PlannedRun;
  findings: Finding[];
  options: BrowserEvidenceOptions;
}

export interface PageEvidenceCaptureResult {
  screenshot?: string;
  diagnostics: Diagnostic[];
}

function diagnostic(
  run: PlannedRun,
  code: "FULL_PAGE_SCREENSHOT_LIMITED" | "RUN_SCREENSHOT_FAILED" | "FINDING_SCREENSHOT_UNAVAILABLE",
  message: string,
): Diagnostic {
  return {
    code,
    severity: "warning",
    message,
    path: `runs.${run.id}`,
  };
}

function firstSafeSelector(targets: readonly string[]): string | undefined {
  return targets.find(
    (target) =>
      target.length > 0 &&
      target.length <= 2_048 &&
      !target.includes("\0") &&
      !target.includes(" >>> "),
  );
}

/**
 * Capture and persist screenshot evidence while the audited page is alive.
 * Exported so failure behavior can be unit-tested with a lightweight page fake.
 */
export async function capturePageEvidence(
  args: CapturePageEvidenceArgs,
): Promise<PageEvidenceCaptureResult> {
  const { page, run, findings, options } = args;
  const diagnostics: Diagnostic[] = [];
  let pageScreenshot: string | undefined;

  if (!options.screenshots) {
    for (const finding of findings) {
      finding.evidence = { htmlSnippet: finding.html };
    }
    return { diagnostics };
  }

  if (!options.sink) {
    diagnostics.push(
      diagnostic(
        run,
        "RUN_SCREENSHOT_FAILED",
        "Screenshot capture was enabled, but no evidence sink was provided; image buffers were omitted.",
      ),
    );
    for (const finding of findings) {
      finding.evidence = { htmlSnippet: finding.html };
    }
    return { diagnostics };
  }

  let fullPage = options.fullPage;
  if (fullPage) {
    try {
      const scrollHeight = await page.evaluate(
        () => {
          const browserGlobal = globalThis as unknown as {
            document: {
              documentElement: { scrollHeight: number };
              body?: { scrollHeight: number };
            };
          };
          return Math.max(
            browserGlobal.document.documentElement.scrollHeight,
            browserGlobal.document.body?.scrollHeight ?? 0,
          );
        },
      );
      if (scrollHeight > MAX_FULL_PAGE_HEIGHT) {
        fullPage = false;
        diagnostics.push(
          diagnostic(
            run,
            "FULL_PAGE_SCREENSHOT_LIMITED",
            `Full-page screenshot height ${scrollHeight}px exceeded the ${MAX_FULL_PAGE_HEIGHT}px limit; captured the viewport instead.`,
          ),
        );
      }
    } catch {
      fullPage = false;
      diagnostics.push(
        diagnostic(
          run,
          "FULL_PAGE_SCREENSHOT_LIMITED",
          "Could not determine full-page dimensions; captured the viewport instead.",
        ),
      );
    }
  }

  try {
    const data = await page.screenshot({ animations: "disabled", fullPage });
    pageScreenshot = await options.sink.writeRunScreenshot({ run, data });
  } catch (error) {
    diagnostics.push(
      diagnostic(
        run,
        "RUN_SCREENSHOT_FAILED",
        `Could not capture the run screenshot: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  for (const finding of findings) {
    const fallbackEvidence = {
      pageScreenshot,
      htmlSnippet: finding.html,
    };
    const selector = firstSafeSelector(finding.target);
    if (!selector) {
      finding.evidence = fallbackEvidence;
      diagnostics.push(
        diagnostic(
          run,
          "FINDING_SCREENSHOT_UNAVAILABLE",
          `No supported target selector was available for finding "${finding.id}".`,
        ),
      );
      continue;
    }

    try {
      const locator = page.locator(selector).first();
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      if (!box) {
        throw new Error("target is hidden or has no bounding box");
      }
      const scroll = await page.evaluate(() => {
        const browserGlobal = globalThis as unknown as { scrollX: number; scrollY: number };
        return { x: browserGlobal.scrollX, y: browserGlobal.scrollY };
      });
      const data = await locator.screenshot({ animations: "disabled" });
      const screenshot = await options.sink.writeFindingScreenshot({
        run,
        finding,
        targetIndex: 0,
        data,
      });
      finding.evidence = {
        screenshot,
        pageScreenshot,
        boundingBox: {
          x: box.x + scroll.x,
          y: box.y + scroll.y,
          width: box.width,
          height: box.height,
        },
        htmlSnippet: finding.html,
      };
    } catch (error) {
      finding.evidence = fallbackEvidence;
      diagnostics.push(
        diagnostic(
          run,
          "FINDING_SCREENSHOT_UNAVAILABLE",
          `Could not capture target evidence for finding "${finding.id}": ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  return { screenshot: pageScreenshot, diagnostics };
}

function classifyNavigationError(error: unknown, url: string): BrowserAuditError {
  const message = error instanceof Error ? error.message : String(error);

  if (/ERR_CONNECTION_REFUSED/i.test(message)) {
    return new BrowserAuditError(
      "connection-refused",
      `Connection refused while navigating to ${url}.`,
      { cause: error },
    );
  }
  if (/Timeout .*exceeded/i.test(message) || /ERR_TIMED_OUT/i.test(message)) {
    return new BrowserAuditError("timeout", `Navigation to ${url} timed out.`, { cause: error });
  }
  if (/Target (page|context|browser)? ?(has been closed|closed)/i.test(message)) {
    return new BrowserAuditError(
      "browser-closed",
      `Browser or page closed unexpectedly while navigating to ${url}.`,
      { cause: error },
    );
  }

  return new BrowserAuditError("navigation-error", `Failed to navigate to ${url}: ${message}`, {
    cause: error,
  });
}
