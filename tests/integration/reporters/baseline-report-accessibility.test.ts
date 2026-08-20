import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";
import { executeAudit } from "@a11yst/core";
import { generateHtmlReport } from "@a11yst/reporters";
import { BASELINE_EXAMPLES } from "../../helpers/baseline.js";
import { startFlowExampleServer, type FlowExampleServer } from "../../helpers/flow-server.js";
import { repoRoot, withTempDir } from "../../helpers/cli.js";

const EXAMPLE = BASELINE_EXAMPLES.legacyHtml;
const TEST_TIMEOUT_MS = 180_000;
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function openReport(page: Page, reportPath: string): Promise<void> {
  await page.goto(pathToFileURL(reportPath).href, { waitUntil: "load" });
}

describe.sequential("baseline report accessibility (real Chromium + axe-core)", () => {
  let browser: Browser | undefined;
  let shared: FlowExampleServer | undefined;
  let stopServer: () => Promise<void> = async () => {};

  beforeAll(async () => {
    browser = await chromium.launch({ channel: "chromium", headless: true });
    const session = await startFlowExampleServer(EXAMPLE, 120_000);
    shared = session.server;
    stopServer = session.stop;
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await stopServer();
    await browser?.close();
  }, 30_000);

  it(
    "renders baseline sections and passes axe checks for serious or critical violations",
    async () => {
      await withTempDir("a11yst-baseline-report-a11y-", async (root) => {
        process.env.PORT = String(shared!.port);
        const config = await loadConfig({ cwd: join(repoRoot, EXAMPLE) });
        const auditResult = await executeAudit(config, {
          writeArtifacts: false,
          html: false,
        });

        expect(auditResult.baselineSummary?.baselineUsed).toBe(true);

        const reportDir = join(root, "report");
        const reportPath = (
          await generateHtmlReport({
            auditResult,
            outputDirectory: reportDir,
            auditId: "baseline-report-a11y",
          })
        ).indexPath;

        const html = await readFile(reportPath, "utf8");
        expect(html).toContain('id="baseline-summary"');
        expect(html).toContain("Baseline comparison");
        expect(html).toContain('id="baseline-new"');
        expect(html).toContain('id="baseline-known"');
        expect(html).toContain('id="baseline-regressed"');
        expect(html).toContain('id="baseline-resolved"');
        expect(html).toContain('id="baseline-not-compared"');
        expect(html).toContain('id="baseline-classified"');
        expect(html).toContain('for="filter-lifecycle"');
        expect(html).toContain('for="filter-disposition"');
        expect(html).toContain('for="filter-expired"');

        await mkdir(join(reportDir, "evidence"), { recursive: true });
        await writeFile(join(reportDir, "evidence/page.png"), PNG_1X1);

        const context = await browser!.newContext();
        const page = await context.newPage();
        await openReport(page, reportPath);

        const axe = await new AxeBuilder({ page })
          .disableRules(["definition-list"])
          .analyze();
        expect(
          axe.violations.filter(
            (violation) => violation.impact === "critical" || violation.impact === "serious",
          ),
        ).toEqual([]);

        expect(await page.locator("html").getAttribute("lang")).toBe("en");
        expect(await page.locator('a.skip-link[href="#main-content"]').count()).toBe(1);
        expect(await page.locator("main#main-content").count()).toBe(1);
        expect(await page.locator("#baseline-summary").count()).toBe(1);
        expect(await page.locator("#baseline-resolved [data-fingerprint]").count()).toBeGreaterThan(
          0,
        );
        expect(await page.locator("#baseline-not-compared [data-fingerprint]").count()).toBeGreaterThan(
          0,
        );

        await context.close();
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "keeps baseline lifecycle findings available without JavaScript",
    async () => {
      await withTempDir("a11yst-baseline-report-noscript-", async (root) => {
        process.env.PORT = String(shared!.port);
        const config = await loadConfig({ cwd: join(repoRoot, EXAMPLE) });
        const auditResult = await executeAudit(config, {
          writeArtifacts: false,
          html: false,
        });

        const reportPath = (
          await generateHtmlReport({
            auditResult,
            outputDirectory: join(root, "report-only"),
            auditId: "baseline-report-noscript",
          })
        ).indexPath;

        const context = await browser!.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        await openReport(page, reportPath);

        expect(await page.locator("#baseline-summary").count()).toBe(1);
        expect(await page.locator("#baseline-known [data-finding]").count()).toBeGreaterThan(0);
        expect(await page.locator("#baseline-new [data-finding]").count()).toBeGreaterThan(0);

        await context.close();
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "filters baseline lifecycle findings with keyboard-accessible controls",
    async () => {
      await withTempDir("a11yst-baseline-report-filters-", async (root) => {
        process.env.PORT = String(shared!.port);
        const config = await loadConfig({ cwd: join(repoRoot, EXAMPLE) });
        const auditResult = await executeAudit(config, {
          writeArtifacts: false,
          html: false,
        });

        const reportPath = (
          await generateHtmlReport({
            auditResult,
            outputDirectory: join(root, "report-filters"),
            auditId: "baseline-report-filters",
          })
        ).indexPath;

        const context = await browser!.newContext();
        const page = await context.newPage();
        await openReport(page, reportPath);

        const totalFindings = await page.locator("[data-finding]").count();
        expect(totalFindings).toBeGreaterThan(0);

        await page.locator("#filter-lifecycle").selectOption("new");
        await page.waitForFunction(
          (expectedTotal) => {
            const visible = document.querySelectorAll("[data-finding]:not([hidden])").length;
            return visible > 0 && visible < expectedTotal;
          },
          totalFindings,
        );
        const filteredCount = await page.locator("[data-finding]:not([hidden])").count();
        expect(filteredCount).toBeGreaterThan(0);
        expect(filteredCount).toBeLessThan(totalFindings);

        await page.locator('form[data-report-filters] button[type="reset"]').click();
        await page.waitForFunction(
          (expected) => {
            const visible = document.querySelectorAll("[data-finding]:not([hidden])").length;
            return visible === expected;
          },
          totalFindings,
        );

        await context.close();
      });
    },
    TEST_TIMEOUT_MS,
  );
});

describe.sequential("baseline report accessibility (classification-expiry example)", () => {
  let browser: Browser | undefined;
  let shared: FlowExampleServer | undefined;
  let stopServer: () => Promise<void> = async () => {};

  beforeAll(async () => {
    browser = await chromium.launch({ channel: "chromium", headless: true });
    const session = await startFlowExampleServer(
      BASELINE_EXAMPLES.classificationExpiry,
      120_000,
    );
    shared = session.server;
    stopServer = session.stop;
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await stopServer();
    await browser?.close();
  }, 30_000);

  it(
    "renders expired classification sections and owner metadata",
    async () => {
      await withTempDir("a11yst-baseline-report-expiry-", async (root) => {
        process.env.PORT = String(shared!.port);
        const config = await loadConfig({
          cwd: join(repoRoot, BASELINE_EXAMPLES.classificationExpiry),
        });
        const auditResult = await executeAudit(config, {
          writeArtifacts: false,
          html: false,
        });

        expect(auditResult.baselineSummary?.expiredClassifications).toBe(1);

        const reportPath = (
          await generateHtmlReport({
            auditResult,
            outputDirectory: join(root, "report-expiry"),
            auditId: "baseline-report-expiry",
          })
        ).indexPath;

        const html = await readFile(reportPath, "utf8");
        expect(html).toContain('id="baseline-expired"');
        expect(html).toContain("Expired classifications");
        expect(html).toContain('for="filter-owner"');
        expect(html).toContain("design-system");

        const context = await browser!.newContext();
        const page = await context.newPage();
        await openReport(page, reportPath);

        expect(await page.locator("#baseline-expired [data-finding]").count()).toBeGreaterThan(0);
        expect(await page.locator("#filter-expired").count()).toBe(1);

        await context.close();
      });
    },
    TEST_TIMEOUT_MS,
  );
});
