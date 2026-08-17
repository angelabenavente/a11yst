import { createServer, type Server } from "node:http";
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { chromium } from "playwright";
import { afterEach, describe, expect, it } from "vitest";
import { capturePageEvidence } from "@a11yst/browser";
import { loadConfig, validateConfig } from "@a11yst/config";
import { executeAudit } from "@a11yst/core";
import type { AuditExecutionResult, Finding, PlannedRun } from "@a11yst/types";
import { repoRoot, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const TEST_TIMEOUT_MS = 180_000;
const activeServers = new Set<Server>();

async function listen(server: Server, port: number): Promise<void> {
  activeServers.add(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  activeServers.delete(server);
}

async function isListening(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    return response.ok;
  } catch {
    return false;
  }
}

async function runAuditExample(
  name: "html-inaccessible" | "html-accessible",
  port: number,
  output: string,
  options: Parameters<typeof executeAudit>[1] = {},
): Promise<AuditExecutionResult> {
  const oldPort = process.env.PORT;
  process.env.PORT = String(port);
  try {
    const config = await loadConfig({ cwd: join(repoRoot, "examples/audit", name) });
    return await executeAudit(config, { outputDir: output, ...options });
  } finally {
    if (oldPort === undefined) delete process.env.PORT;
    else process.env.PORT = oldPort;
  }
}

async function filesBelow(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      return entry.isDirectory() ? filesBelow(path) : [path];
    }),
  );
  return nested.flat();
}

async function expectRealPng(path: string): Promise<void> {
  const data = await readFile(path);
  expect(data.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(data.readUInt32BE(16)).toBeGreaterThan(0);
  expect(data.readUInt32BE(20)).toBeGreaterThan(0);
}

function persistedPaths(value: unknown, key = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => persistedPaths(item, key));
  if (!value || typeof value !== "object") {
    return typeof value === "string" &&
      /^(?:configPath|projectRoot|manifestPath|resultsPath|reportPath|latestPath|outputDirectory|evidenceDirectory|screenshot|pageScreenshot)$/i.test(
        key,
      )
      ? [value]
      : [];
  }
  return Object.entries(value).flatMap(([childKey, child]) => persistedPaths(child, childKey));
}

afterEach(async () => {
  await Promise.all([...activeServers].map((server) => close(server)));
});

describe.sequential("browser artifacts and evidence (real Chromium)", () => {
  it("writes a portable evidence bundle for html-inaccessible", async () => {
    await withTempDir("a11yst-artifacts-html-", async (output) => {
      const port = await getFreePort();
      const auditId = "html-inaccessible-evidence";
      const result = await runAuditExample("html-inaccessible", port, output, {
        artifactAuditId: auditId,
        artifactNow: new Date("2026-08-03T12:34:56.000Z"),
      });

      expect(result.status).toBe("completed");
      expect(result.summary.failedRuns).toBe(0);
      expect(result.summary.completedRuns).toBeGreaterThanOrEqual(1);
      const rules = result.findings.map((finding) => finding.ruleId);
      expect(rules).toContain("button-name");
      expect(rules.some((rule) => rule === "label" || rule === "image-alt")).toBe(true);

      const runDir = result.artifacts!.outputDirectory;
      expect(result.artifacts?.reportPath).toBeTruthy();
      expect(result.artifacts!.reportPath!.endsWith("report/index.html")).toBe(true);
      for (const run of result.runs) {
        expect(run.status).toBe("completed");
        expect(run.evidence?.screenshot).toBeTruthy();
        await expectRealPng(join(runDir, run.evidence!.screenshot!));
        for (const finding of run.findings) {
          expect(finding.evidence?.pageScreenshot).toBe(run.evidence?.screenshot);
        }
      }
      const localized = result.findings.find(
        (finding) => finding.evidence?.screenshot && finding.evidence.boundingBox,
      );
      expect(localized).toBeDefined();
      expect(localized!.evidence!.boundingBox!.width).toBeGreaterThan(0);
      await expectRealPng(join(runDir, localized!.evidence!.screenshot!));

      for (const path of [
        result.artifacts!.manifestPath,
        result.artifacts!.resultsPath,
        result.artifacts!.reportPath!,
        result.artifacts!.latestPath,
        result.artifacts!.evidenceDirectory!,
        join(runDir, "report/styles.css"),
        join(runDir, "report/report.js"),
      ]) {
        await access(path);
      }
      const manifest = JSON.parse(await readFile(result.artifacts!.manifestPath, "utf8")) as {
        auditId: string;
        createdAt: string;
        artifactCounts: { screenshots: number; findings: number; runs: number };
        reportPath?: string;
      };
      const persisted = JSON.parse(await readFile(result.artifacts!.resultsPath, "utf8"));
      const latest = JSON.parse(await readFile(result.artifacts!.latestPath, "utf8")) as {
        auditId: string;
        resultsPath: string;
      };
      expect(manifest.auditId).toBe(auditId);
      expect(manifest.createdAt).toBe("2026-08-03T12:34:56.000Z");
      expect(manifest.reportPath).toBe("report/index.html");
      expect(manifest.artifactCounts).toEqual({
        screenshots: (await filesBelow(join(runDir, "evidence"))).filter((path) =>
          path.endsWith(".png"),
        ).length,
        findings: result.findings.length,
        runs: result.runs.length,
      });
      expect(latest.auditId).toBe(auditId);
      expect(latest.resultsPath).toBe(`runs/${auditId}/results.json`);
      expect(persistedPaths(manifest).every((path) => !isAbsolute(path))).toBe(true);
      expect(persistedPaths(persisted).every((path) => !isAbsolute(path))).toBe(true);
      expect(Object.values(result.artifacts!).every((path) => isAbsolute(path))).toBe(true);
      expect(await isListening(port)).toBe(false);
    });
  }, TEST_TIMEOUT_MS);

  it("supports disabled and full-page screenshot modes", async () => {
    await withTempDir("a11yst-artifacts-modes-", async (root) => {
      const disabled = await runAuditExample(
        "html-inaccessible",
        await getFreePort(),
        join(root, "disabled"),
        { artifactAuditId: "screenshots-disabled", screenshots: false },
      );
      expect(disabled.status).toBe("completed");
      expect(disabled.runs.every((run) => run.evidence?.screenshot === undefined)).toBe(true);
      expect(
        (await filesBelow(disabled.artifacts!.outputDirectory)).some((path) =>
          path.endsWith(".png"),
        ),
      ).toBe(false);
      await access(disabled.artifacts!.resultsPath);
      expect(disabled.artifacts?.evidenceDirectory).toBeUndefined();

      const fullPage = await runAuditExample(
        "html-inaccessible",
        await getFreePort(),
        join(root, "full-page"),
        { artifactAuditId: "full-page", fullPageScreenshots: true },
      );
      expect(fullPage.status).toBe("completed");
      const screenshot = fullPage.runs[0]?.evidence?.screenshot;
      expect(screenshot).toBeTruthy();
      await expectRealPng(join(fullPage.artifacts!.outputDirectory, screenshot!));
    });
  }, TEST_TIMEOUT_MS);

  it("retains a finding with page fallback when target localization fails", async () => {
    await withTempDir("a11yst-artifacts-fallback-", async (dir) => {
      const browser = await chromium.launch({ channel: "chromium", headless: true });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(2_000);
        await page.setContent(
          "<!doctype html><html lang=\"en\"><title>Fallback</title><body><main>Fixture</main></body></html>",
        );
        const finding: Finding = {
          id: "unlocatable",
          fingerprint: "unlocatable-fingerprint",
          source: "axe",
          ruleId: "button-name",
          title: "Button needs a name",
          severity: "high",
          projectName: "fallback",
          profile: "default",
          target: ["#does-not-exist"],
          standards: ["wcag2a"],
        };
        const run: PlannedRun = {
          id: "fallback-run",
          projectName: "fallback",
          platform: "web",
          framework: "html",
          profile: "default",
          routeId: "home",
          viewport: { name: "desktop", width: 800, height: 600 },
        };
        const captured = await capturePageEvidence({
          page,
          run,
          findings: [finding],
          options: {
            screenshots: true,
            fullPage: false,
            sink: {
              async writeRunScreenshot({ data }) {
                const path = join(dir, "page.png");
                await writeFile(path, data);
                return "page.png";
              },
              async writeFindingScreenshot() {
                throw new Error("finding screenshot must not be written");
              },
            },
          },
        });
        expect(captured.screenshot).toBe("page.png");
        expect(finding.evidence?.pageScreenshot).toBe("page.png");
        expect(finding.evidence?.screenshot).toBeUndefined();
        expect(
          captured.diagnostics.some((item) => item.code === "FINDING_SCREENSHOT_UNAVAILABLE"),
        ).toBe(true);
        await expectRealPng(join(dir, "page.png"));
      } finally {
        await browser.close();
      }
    });
  }, TEST_TIMEOUT_MS);

  it("reuses an external server without stopping it", async () => {
    await withTempDir("a11yst-artifacts-reuse-", async (output) => {
      const port = await getFreePort();
      const server = createServer((_request, response) => {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(
          "<!doctype html><html lang=\"en\"><title>External</title><body><main><h1>External server</h1></main></body></html>",
        );
      });
      await listen(server, port);
      const config = validateConfig({
        outputDir: output,
        projects: [
          {
            name: "external",
            platform: "web",
            framework: "html",
            baseUrl: `http://127.0.0.1:${port}`,
            devServer: { reuseExisting: true },
            routes: [{ id: "home", path: "/" }],
            profiles: ["default"],
            viewports: [{ name: "desktop", width: 800, height: 600 }],
          },
        ],
      });
      const result = await executeAudit(config, { artifactAuditId: "external-reuse" });
      expect(result.status).toBe("completed");
      expect(result.artifacts?.resultsPath).toBeTruthy();
      await access(result.artifacts!.resultsPath);
      expect(await isListening(port)).toBe(true);
      await close(server);
      expect(await isListening(port)).toBe(false);
    });
  }, TEST_TIMEOUT_MS);
});
