import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, validateConfig } from "@a11yst/config";
import { createAuditPlan, executeAudit, prepareAuditConfig } from "@a11yst/core";
import { adapterFixture } from "../../helpers/adapters.js";
import { repoRoot, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const DEFAULT_TEST_TIMEOUT_MS = 120_000;
const SLOW_FRAMEWORK_TIMEOUT_MS = 180_000;

interface FrameworkExampleSpec {
  dirName: string;
  adapterId: string;
  expectedRunCount: number;
  findingRule: "button-name" | "label";
  /** When set, at least one run should carry this route origin. */
  expectFilesystemOrigin?: boolean;
  timeoutMs?: number;
}

const FRAMEWORK_EXAMPLES: FrameworkExampleSpec[] = [
  {
    dirName: "html-site",
    adapterId: "html",
    expectedRunCount: 2,
    findingRule: "button-name",
    expectFilesystemOrigin: true,
  },
  {
    dirName: "react-vite",
    adapterId: "react",
    expectedRunCount: 2,
    findingRule: "button-name",
  },
  {
    dirName: "next-app",
    adapterId: "next",
    expectedRunCount: 3,
    findingRule: "button-name",
    expectFilesystemOrigin: true,
    timeoutMs: SLOW_FRAMEWORK_TIMEOUT_MS,
  },
  {
    dirName: "angular-app",
    adapterId: "angular",
    expectedRunCount: 2,
    findingRule: "button-name",
  },
  {
    dirName: "vue-vite",
    adapterId: "vue",
    expectedRunCount: 2,
    findingRule: "button-name",
  },
  {
    dirName: "nuxt-app",
    adapterId: "nuxt",
    expectedRunCount: 3,
    findingRule: "label",
    expectFilesystemOrigin: true,
    timeoutMs: SLOW_FRAMEWORK_TIMEOUT_MS,
  },
];

function frameworkExampleDir(name: string): string {
  return join(repoRoot, "examples/frameworks", name);
}

async function runFrameworkAudit(
  dirName: string,
  port: number,
  outputDir: string,
  artifactAuditId: string,
) {
  const exampleDir = frameworkExampleDir(dirName);
  const previousPort = process.env.PORT;
  process.env.PORT = String(port);
  try {
    if (dirName === "nuxt-app") {
      process.env.NUXT_IGNORE_LOCK = "1";
    }
    const config = await loadConfig({ cwd: exampleDir });
    return await executeAudit(config, {
      outputDir,
      writeArtifacts: true,
      artifactAuditId,
      artifactNow: new Date("2026-08-03T12:34:56.000Z"),
    });
  } finally {
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }
  }
}

function completedRuns(result: Awaited<ReturnType<typeof executeAudit>>) {
  return result.runs.filter((run) => run.status === "completed");
}

describe.sequential("Phase 5 framework browser audits (real Chromium + dev servers)", () => {
  for (const example of FRAMEWORK_EXAMPLES) {
    it(
      `${example.dirName}: completes with adapter metadata, findings, and artifacts`,
      async () => {
        await withTempDir(`a11yst-framework-${example.dirName}-`, async (outputDir) => {
          const port = await getFreePort();
          const auditId = `framework-${example.dirName}`;
          const result = await runFrameworkAudit(example.dirName, port, outputDir, auditId);

          expect(["completed", "completed-with-errors"]).toContain(result.status);
          expect(result.summary.plannedRuns).toBe(example.expectedRunCount);
          expect(result.summary.completedRuns).toBe(example.expectedRunCount);
          expect(result.summary.failedRuns).toBe(0);

          expect(completedRuns(result)).toHaveLength(example.expectedRunCount);
          expect(
            completedRuns(result).every(
              (run) => run.adapter?.adapterId === example.adapterId,
            ),
          ).toBe(true);

          const runsWithFinding = completedRuns(result).filter((run) =>
            run.findings.some((finding) => finding.ruleId === example.findingRule),
          );
          expect(runsWithFinding.length).toBeGreaterThanOrEqual(1);

          if (example.expectFilesystemOrigin) {
            expect(
              completedRuns(result).some((run) => run.adapter?.routeOrigin === "filesystem"),
            ).toBe(true);
          }

          expect(result.artifacts).toBeDefined();
          await access(result.artifacts!.manifestPath);
          await access(result.artifacts!.resultsPath);
          await access(result.artifacts!.reportPath!);

          const manifest = JSON.parse(await readFile(result.artifacts!.manifestPath, "utf8"));
          expect(manifest.auditId).toBe(auditId);
          expect(manifest.status).toBe(result.status);
        });
      },
      example.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS,
    );
  }

  it("validateConfig svelte project plans runs with generic-web adapter", async () => {
    const config = validateConfig(
      {
        projects: [
          {
            name: "svelte-site",
            platform: "web",
            framework: "svelte",
            baseUrl: "http://127.0.0.1:3000",
            routes: [{ id: "home", name: "Home", path: "/" }],
            profiles: ["default"],
            viewports: [{ name: "desktop", width: 1440, height: 900 }],
          },
        ],
      },
      { configDir: adapterFixture("html") },
    );

    const plan = createAuditPlan(await prepareAuditConfig(config));

    expect(plan.totalRuns).toBe(1);
    expect(plan.runs[0]?.adapter?.adapterId).toBe("generic-web");
    expect(plan.runs[0]?.adapter?.supportLevel).toBe("preview");
  });

  it("next fixture skips dynamic patterns when no samples are configured", async () => {
    const config = validateConfig(
      {
        projects: [
          {
            name: "next-web",
            platform: "web",
            framework: "next",
            rootDir: ".",
            baseUrl: "http://127.0.0.1:3000",
            routeDiscovery: { mode: "fallback", samples: {} },
            profiles: ["default"],
            viewports: [{ name: "desktop", width: 1440, height: 900 }],
          },
        ],
      },
      { configDir: adapterFixture("next/app-router") },
    );

    const prepared = await prepareAuditConfig(config);
    const plan = createAuditPlan(prepared);

    expect(plan.runs.map((run) => run.route?.path).sort()).toEqual(["/", "/about", "/pricing"]);
    expect(
      prepared.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "ROUTE_PATTERN_SKIPPED" &&
          /\/blog\/:slug/.test(diagnostic.message),
      ),
    ).toBe(true);
  });

  it("merge mode combines explicit and discovered html routes", async () => {
    const config = validateConfig(
      {
        projects: [
          {
            name: "merged-site",
            platform: "web",
            framework: "html",
            baseUrl: "http://127.0.0.1:3000",
            routes: [{ id: "custom", name: "Custom", path: "/custom" }],
            routeDiscovery: { mode: "merge", include: [], exclude: [], samples: {} },
            profiles: ["default"],
            viewports: [{ name: "desktop", width: 1440, height: 900 }],
          },
        ],
      },
      { configDir: adapterFixture("html") },
    );

    const plan = createAuditPlan(await prepareAuditConfig(config));

    expect(plan.runs.map((run) => run.route?.path)).toEqual([
      "/custom",
      "/",
      "/about.html",
      "/about/",
      "/docs/guide/",
    ]);
    expect(plan.runs.some((run) => run.adapter?.routeOrigin === "explicit")).toBe(true);
    expect(plan.runs.some((run) => run.adapter?.routeOrigin === "filesystem")).toBe(true);
  });
});
