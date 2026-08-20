import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateHtmlReport } from "@a11yst/reporters";
import type {
  AuditExecutionResult,
  AuditRunResult,
  AuditRunStatus,
  Finding,
  Severity,
} from "@a11yst/types";
import { withTempDir } from "../../helpers/cli.js";

const TEST_TIMEOUT_MS = 120_000;
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function finding(index: number, severity: Severity = "high"): Finding {
  return {
    id: `finding-${index}`,
    fingerprint: `fingerprint-${index}`,
    source: "axe",
    ruleId: index % 2 ? "button-name" : "image-alt",
    title: index % 2 ? "Buttons must have discernible text" : "Images must have alternate text",
    description: "A real report fixture finding.",
    severity,
    routeId: "issues",
    routeName: "Issues",
    route: "/issues",
    url: "http://127.0.0.1/issues",
    projectName: "report-site",
    profile: "default",
    viewport: "mobile",
    target: [index % 2 ? "#unnamed" : "main img"],
    html: index % 2 ? "<button></button>" : "<img src=\"example.png\">",
    failureSummary: "Fix the accessible name.",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.10/button-name",
    standards: ["wcag2a", "wcag412"],
    evidence: {
      screenshot: `evidence/finding-${index}.png`,
      pageScreenshot: "evidence/page.png",
      boundingBox: { x: 10, y: 20, width: 30, height: 40 },
    },
  };
}

function run(
  id: string,
  status: AuditRunStatus,
  findings: Finding[] = [],
  viewport = { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
): AuditRunResult {
  return {
    runId: id,
    projectName: "report-site",
    platform: "web",
    framework: "react",
    routeId: "issues",
    routeName: "Issues",
    route: "/issues",
    url: "http://127.0.0.1/issues",
    profile: status === "skipped" ? "keyboard" : "default",
    viewport,
    status,
    startedAt: "2026-08-03T10:00:00.000Z",
    durationMs: status === "completed" ? 123 : 0,
    findings,
    diagnostics: status === "failed"
      ? [{ code: "NAVIGATION_FAILED", severity: "error", message: "Fixture failure" }]
      : [],
    ...(status === "completed"
      ? {
          evidence: {
            screenshot: "evidence/page.png",
            capturedAt: "2026-08-03T10:00:00.123Z",
            viewport: {
              name: viewport.name,
              width: viewport.width,
              height: viewport.height,
              deviceScaleFactor: 1,
              isMobile: viewport.isMobile ?? false,
              hasTouch: viewport.hasTouch ?? false,
              orientation: viewport.width >= viewport.height ? "landscape" : "portrait",
            },
          },
        }
      : { skipReason: status === "skipped" ? "Keyboard profile is not enabled." : "Navigation failed." }),
  };
}

function result(name: string, runs: AuditRunResult[]): AuditExecutionResult {
  const findings = runs.flatMap((item) => item.findings);
  const severities: Record<Severity, number> = {
    critical: 0,
    high: 0,    medium: 0,
    minor: 0,
  };
  for (const item of findings) severities[item.severity] += 1;
  return {
    schemaVersion: "1",
    auditId: name,
    status: runs.some((item) => item.status === "failed") ? "failed" : "completed",
    summary: {
      status: runs.some((item) => item.status === "failed") ? "failed" : "completed",
      startedAt: "2026-08-03T10:00:00.000Z",
      durationMs: 123,
      plannedRuns: runs.length,
      completedRuns: runs.filter((item) => item.status === "completed").length,
      skippedRuns: runs.filter((item) => item.status === "skipped").length,
      failedRuns: runs.filter((item) => item.status === "failed").length,
      findingCount: findings.length,
      findingsBySeverity: severities,
    },
    plan: {
      projects: [],
      runs: [],
      totalRuns: runs.length,
      diagnostics: [],
      createdAt: "2026-08-03T10:00:00.000Z",
    },
    runs,
    findings,
    diagnostics: [],
    limitations: ["Automated checks do not establish accessibility conformance."],
    environment: {
      product: "a11yst",
      productVersion: "0.1.0",
      nodeVersion: process.version,
      browser: "chromium",
      headed: false,
    },
  };
}

async function writeReport(root: string, auditResult: AuditExecutionResult): Promise<string> {
  await mkdir(join(root, "evidence"), { recursive: true });
  await Promise.all([
    writeFile(join(root, "evidence/page.png"), PNG_1X1),
    ...auditResult.findings.map((_, index) =>
      writeFile(join(root, `evidence/finding-${index + 1}.png`), PNG_1X1),
    ),
  ]);
  return (await generateHtmlReport({
    auditResult,
    outputDirectory: root,
    auditId: auditResult.auditId,
  })).indexPath;
}

async function openReport(page: Page, reportPath: string): Promise<string[]> {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(pathToFileURL(reportPath).href, { waitUntil: "load" });
  return requests;
}

describe.sequential("generated report accessibility (real Chromium + axe-core)", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ channel: "chromium", headless: true });
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it("has no serious or critical axe violations across report result shapes", async () => {
    await withTempDir("a11yst-report-a11y-", async (root) => {
      const fixtures = [
        result("no-findings", [run("clean", "completed")]),
        result("multiple-findings", [
          run("issues", "completed", [
            finding(1, "critical"),
            finding(2, "high"),
            finding(3, "medium"),
          ]),
        ]),
        result("skipped-and-failed", [
          run("skipped", "skipped"),
          run("failed", "failed"),
        ]),
        result("responsive-viewport", [
          run("mobile", "completed", [finding(1)], {
            name: "mobile",
            width: 320,
            height: 568,
            isMobile: true,
            hasTouch: true,
          }),
          run("desktop", "completed", [], {
            name: "desktop",
            width: 1440,
            height: 900,
            isMobile: false,
            hasTouch: false,
          }),
        ]),
        result("flow-checkpoints", [
          {
            ...run("flow-open", "completed", [
              {
                ...finding(1, "medium"),
                source: "a11yst",
                ruleId: "form-error-focus-review",
                flowId: "checkout-validation-errors",
                checkpointId: "validation-errors",
              },
            ]),
            kind: "flow-checkpoint",
            flowId: "checkout-validation-errors",
            checkpointId: "validation-errors",
            profile: "keyboard",
          },
        ]),
      ];

      for (const fixture of fixtures) {
        const reportPath = await writeReport(join(root, fixture.auditId!), fixture);
        const context = await browser.newContext();
        const page = await context.newPage();
        const requests = await openReport(page, reportPath);
        const axe = await new AxeBuilder({ page }).analyze();
        expect(
          axe.violations.filter((violation) =>
            violation.impact === "critical" || violation.impact === "serious",
          ),
          `${fixture.auditId}: ${axe.violations.map((violation) => violation.id).join(", ")}`,
        ).toEqual([]);
        expect(await page.locator("html").getAttribute("lang")).toBe("en");
        expect(await page.locator("title").count()).toBe(1);
        expect(await page.title()).toContain("a11yst accessibility report");
        expect(await page.locator('a.skip-link[href="#main-content"]').count()).toBe(1);
        expect(await page.locator("header").count()).toBe(1);
        expect(await page.locator("main#main-content").count()).toBe(1);
        expect(await page.locator('nav[aria-label="Report sections"]').count()).toBe(1);
        expect(await page.locator("footer").count()).toBe(1);
        expect(await page.locator("select").evaluateAll((items) =>
          items.every((item) => Boolean(item.getAttribute("id")) &&
            Boolean((globalThis as unknown as {
              document: { querySelector(selector: string): unknown };
            }).document.querySelector(`label[for="${item.id}"]`))),
        )).toBe(true);
        expect(await page.locator("img").evaluateAll((items) =>
          items.every((item) => Boolean(item.getAttribute("alt"))),
        )).toBe(true);
        expect(requests.every((url) => url.startsWith("file:") || url.startsWith("data:"))).toBe(true);
        await context.close();
      }
    });
  }, TEST_TIMEOUT_MS);

  it("keeps all findings available without JavaScript and supports keyboard and narrow layouts", async () => {
    await withTempDir("a11yst-report-behavior-", async (root) => {
      const fixture = result("behavior", [
        run("issues", "completed", [finding(1), finding(2), finding(3)]),
      ]);
      const reportPath = await writeReport(root, fixture);

      const noScriptContext = await browser.newContext({ javaScriptEnabled: false });
      const noScriptPage = await noScriptContext.newPage();
      await noScriptPage.goto(pathToFileURL(reportPath).href);
      expect(await noScriptPage.locator("[data-finding]").count()).toBe(3);
      expect(await noScriptPage.locator("[data-finding]:visible").count()).toBe(3);
      await noScriptContext.close();

      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(pathToFileURL(reportPath).href);
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => {
        const browserGlobal = globalThis as unknown as {
          document: { activeElement?: { className?: string } };
        };
        return browserGlobal.document.activeElement?.className;
      })).toContain("skip-link");
      const reached = new Set<string>();
      for (let index = 0; index < 24; index += 1) {
        await page.keyboard.press("Tab");
        const marker = await page.evaluate(() => {
          const browserGlobal = globalThis as unknown as {
            document: { activeElement?: { id?: string; tagName?: string } };
          };
          const active = browserGlobal.document.activeElement;
          return active?.id || (active?.tagName === "BUTTON" ? "clear-filters" : "");
        });
        if (marker) reached.add(marker);
      }
      expect(reached.has("filter-severity")).toBe(true);
      expect(reached.has("filter-status")).toBe(true);
      expect(reached.has("clear-filters")).toBe(true);

      const css = await page.locator('link[rel="stylesheet"]').getAttribute("href");
      expect(css).toBe("styles.css");
      const styles = await readFile(join(root, "report/styles.css"), "utf8");
      expect(styles).toMatch(/:focus-visible/);

      for (const width of [320, 400]) {
        await page.setViewportSize({ width, height: 720 });
        const overflow = await page.evaluate(() => {
          const browserGlobal = globalThis as unknown as {
            document: { documentElement: { scrollWidth: number; clientWidth: number } };
          };
          return browserGlobal.document.documentElement.scrollWidth -
            browserGlobal.document.documentElement.clientWidth;
        });
        expect(overflow).toBeLessThanOrEqual(1);
        expect(await page.locator("img.evidence").evaluateAll((items) =>
          items.every((item) => item.getBoundingClientRect().width <=
            (globalThis as unknown as {
              document: { documentElement: { clientWidth: number } };
            }).document.documentElement.clientWidth),
        )).toBe(true);
      }
      await context.close();
    });
  }, TEST_TIMEOUT_MS);
});
