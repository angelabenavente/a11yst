import { access, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AuditExecutionResult, Finding } from "@a11yst/types";
import { ensureDir, runCli, withTempDir } from "../../helpers/cli.js";

function fixture(): AuditExecutionResult {
  const finding: Finding = {
    id: "finding-1",
    fingerprint: "fingerprint-1",
    source: "axe",
    ruleId: "image-alt",
    title: "Images must have alternate text",
    description: "An image has no alternate text.",
    severity: "critical",
    routeId: "home",
    routeName: "Home",
    route: "/",
    url: "http://localhost:3000/",
    projectName: "site",
    profile: "default",
    viewport: "desktop",
    target: ["main", "img"],
    standards: ["wcag2a"],
  };

  return {
    schemaVersion: "1",
    auditId: "audit-report-test",
    status: "completed",
    summary: {
      status: "completed",
      startedAt: "2026-08-03T10:00:00.000Z",
      durationMs: 42,
      plannedRuns: 1,
      completedRuns: 1,
      skippedRuns: 0,
      failedRuns: 0,
      findingCount: 1,
      findingsBySeverity: {
        critical: 1,
        high: 0,        medium: 0,
        minor: 0,
      },
    },
    plan: {
      projects: [],
      runs: [],
      totalRuns: 1,
      diagnostics: [],
      createdAt: "2026-08-03T10:00:00.000Z",
    },
    runs: [
      {
        runId: "run-1",
        projectName: "site",
        platform: "web",
        framework: "html",
        routeId: "home",
        routeName: "Home",
        route: "/",
        url: "http://localhost:3000/",
        profile: "default",
        viewport: { name: "desktop", width: 1280, height: 720 },
        status: "completed",
        startedAt: "2026-08-03T10:00:00.000Z",
        durationMs: 42,
        findings: [finding],
        diagnostics: [],
      },
    ],
    findings: [finding],
    diagnostics: [],
    limitations: ["Automated checks do not establish conformance."],
    environment: {
      product: "a11yst",
      productVersion: "1.0.0",
      nodeVersion: "20.0.0",
      browser: "chromium",
      headed: false,
    },
  };
}

async function writeResult(directory: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  const path = join(directory, "results.json");
  await writeFile(path, JSON.stringify(fixture()), "utf8");
  return path;
}

describe("CLI report integration (persisted JSON only)", () => {
  it("generates a report from an explicit result and includes its finding", async () => {
    await withTempDir("a11yst-report-", async (dir) => {
      const resultsPath = await writeResult(join(dir, "run"));
      const result = await runCli(["report", resultsPath], { cwd: dir });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("audit-report-test");
      const reportPath = join(dir, "run", "report", "index.html");
      const html = await readFile(reportPath, "utf8");
      expect(html).toContain("Images must have alternate text");
      expect(html).toContain("image-alt");
    });
  });

  it("--json emits one pure JSON document", async () => {
    await withTempDir("a11yst-report-json-", async (dir) => {
      const resultsPath = await writeResult(join(dir, "run"));
      const result = await runCli(["report", "run/results.json", "--json"], { cwd: dir });

      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        status: string;
        resultsPath: string;
        reportPath: string;
        auditId: string;
      };
      expect(payload.status).toBe("generated");
      expect(payload.resultsPath).toBe(await realpath(resultsPath));
      expect(payload.reportPath).toBe(
        join(await realpath(dir), "run", "report", "index.html"),
      );
      expect(payload.auditId).toBe("audit-report-test");
      expect(result.stderr).toBe("");
    });
  });

  it("writes the report bundle beneath a custom output directory", async () => {
    await withTempDir("a11yst-report-output-", async (dir) => {
      await writeResult(join(dir, "run"));
      const result = await runCli(
        ["report", "run/results.json", "--output", "published", "--json"],
        { cwd: dir },
      );

      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as { reportPath: string };
      expect(payload.reportPath).toBe(
        join(await realpath(dir), "published", "report", "index.html"),
      );
      await access(payload.reportPath);
    });
  });

  it.each([
    {
      format: "sarif",
      output: "published/a11yst.sarif",
      resultPathKey: "sarifPath",
      expectedContent: '"version": "2.1.0"',
    },
    {
      format: "github-annotations",
      output: "published/github-annotations.txt",
      resultPathKey: "githubAnnotationsPath",
      expectedContent: "",
    },
  ])("generates $format through the shared report emitter", async ({
    format,
    output,
    resultPathKey,
    expectedContent,
  }) => {
    await withTempDir(`a11yst-report-${format}-`, async (dir) => {
      await writeResult(join(dir, "run"));
      const result = await runCli(
        [
          "report",
          "run/results.json",
          "--format",
          format,
          "--output",
          output,
          "--json",
        ],
        { cwd: dir },
      );

      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as Record<string, unknown>;
      const generatedPath = payload[resultPathKey];
      expect(generatedPath).toBe(join(await realpath(dir), output));
      const contents = await readFile(String(generatedPath), "utf8");
      if (expectedContent) {
        expect(contents).toContain(expectedContent);
      } else {
        expect(contents).toBe("");
      }
    });
  });

  it.each([
    {
      name: "missing result",
      path: "missing.json",
      contents: undefined,
      message: /unable to read audit result/i,
    },
    {
      name: "invalid JSON",
      path: "invalid.json",
      contents: "{not json",
      message: /unable to read audit result/i,
    },
    {
      name: "incompatible schema",
      path: "incompatible.json",
      contents: JSON.stringify({ ...fixture(), schemaVersion: "2" }),
      message: /incompatible.*schemaVersion/i,
    },
  ])("exits 1 for $name", async ({ path, contents, message }) => {
    await withTempDir("a11yst-report-error-", async (dir) => {
      if (contents !== undefined) {
        await writeFile(join(dir, path), contents, "utf8");
      }
      const result = await runCli(["report", path, "--json"], { cwd: dir });

      expect(result.code).toBe(1);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
      expect(result.stderr).toMatch(message);
    });
  });

  it("handles result and output directories containing spaces", async () => {
    await withTempDir("a11yst report spaces-", async (dir) => {
      await writeResult(join(dir, "run with spaces"));
      const result = await runCli(
        [
          "report",
          "run with spaces/results.json",
          "--output",
          "output with spaces",
          "--json",
        ],
        { cwd: dir },
      );

      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as { reportPath: string };
      expect(payload.reportPath).toBe(
        join(await realpath(dir), "output with spaces", "report", "index.html"),
      );
      await access(payload.reportPath);
    });
  });

  it("resolves the default latest descriptor without a config or browser", async () => {
    await withTempDir("a11yst-report-latest-", async (dir) => {
      const outputRoot = join(dir, ".a11yst", "results");
      const runDirectory = join(outputRoot, "runs", "audit-latest");
      await writeResult(runDirectory);
      await ensureDir(outputRoot);
      await writeFile(
        join(outputRoot, "latest.json"),
        JSON.stringify({
          schemaVersion: "1",
          auditId: "audit-latest",
          manifestPath: "runs/audit-latest/manifest.json",
          resultsPath: "runs/audit-latest/results.json",
          createdAt: "2026-08-03T10:00:00.000Z",
        }),
        "utf8",
      );

      const result = await runCli(["report", "--json"], {
        cwd: dir,
        env: { PLAYWRIGHT_BROWSERS_PATH: join(dir, "browser-must-not-be-used") },
      });

      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        resultsPath: string;
        reportPath: string;
      };
      expect(payload.resultsPath).toBe(
        join(await realpath(dir), ".a11yst", "results", "runs", "audit-latest", "results.json"),
      );
      expect(payload.reportPath).toBe(
        join(await realpath(dir), ".a11yst", "results", "runs", "audit-latest", "report", "index.html"),
      );
      await access(payload.reportPath);
    });
  });

  it("uses a configured output directory when resolving latest", async () => {
    await withTempDir("a11yst-report-config-latest-", async (dir) => {
      await writeFile(
        join(dir, "a11yst.config.mjs"),
        `export default {
          outputDir: "audit output",
          projects: [{
            name: "website",
            platform: "web",
            framework: "html",
            baseUrl: "http://127.0.0.1:3000",
            routes: ["/"],
            profiles: ["default"],
          }],
        };`,
        "utf8",
      );
      const outputRoot = join(dir, "audit output");
      const runDirectory = join(outputRoot, "runs", "configured");
      await writeResult(runDirectory);
      await writeFile(
        join(outputRoot, "latest.json"),
        JSON.stringify({
          schemaVersion: "1",
          auditId: "configured",
          resultsPath: "runs/configured/results.json",
        }),
        "utf8",
      );

      const result = await runCli(["report", "--json"], { cwd: dir });
      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as { resultsPath: string };
      expect(payload.resultsPath).toContain("audit output/runs/configured/results.json");
    });
  });

  it.each([
    {
      name: "missing",
      descriptor: undefined,
      message: /unable to read latest audit descriptor/i,
    },
    {
      name: "malformed",
      descriptor: "{not json",
      message: /invalid latest audit descriptor/i,
    },
    {
      name: "traversing",
      descriptor: JSON.stringify({
        schemaVersion: "1",
        resultsPath: "../outside/results.json",
      }),
      message: /relative path without traversal/i,
    },
    {
      name: "incompatible",
      descriptor: JSON.stringify({
        schemaVersion: "2",
        resultsPath: "runs/audit/results.json",
      }),
      message: /incompatible latest audit descriptor/i,
    },
  ])("rejects a $name latest descriptor safely", async ({ descriptor, message }) => {
    await withTempDir("a11yst-report-bad-latest-", async (dir) => {
      if (descriptor !== undefined) {
        const outputRoot = join(dir, ".a11yst", "results");
        await ensureDir(outputRoot);
        await writeFile(join(outputRoot, "latest.json"), descriptor, "utf8");
      }

      const result = await runCli(["report", "--json"], { cwd: dir });
      expect(result.code).toBe(1);
      const payload = JSON.parse(result.stdout) as { status: string; message: string };
      expect(payload.status).toBe("error");
      expect(payload.message).toMatch(/a11yst audit/i);
      expect(result.stderr).toMatch(message);
    });
  });
});
