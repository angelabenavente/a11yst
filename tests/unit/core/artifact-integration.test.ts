import { createArtifactWriter } from "@a11yst/artifacts";
import { validateConfig } from "@a11yst/config";
import {
  buildRunId,
  createArtifactEvidenceSink,
  createAuditPlan,
  createFlowEvidenceSink,
  executeAudit,
  resolveAuditOutputDirectory,
} from "@a11yst/core";
import type { Finding, FlowTrace, PlannedRun, ResolvedConfig } from "@a11yst/types";
import { access, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const artifactNow = new Date("2026-08-03T18:25:01.234Z");

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "a11yst-core-artifacts-"));
  temporaryDirectories.push(directory);
  return directory;
}

/**
 * HTML project with no files and no explicit routes. Discovery finds nothing,
 * so executeAudit persists a bundle without launching a browser.
 */
function emptyWebConfig(configDir: string, outputDir?: string): ResolvedConfig {
  return validateConfig(
    {
      ...(outputDir !== undefined ? { outputDir } : {}),
      projects: [
        {
          name: "static-site",
          platform: "web",
          framework: "html",
          baseUrl: "http://127.0.0.1:9",
          rootDir: ".",
          routeDiscovery: { mode: "fallback" },
          profiles: ["default"],
        },
      ],
    },
    {
      configDir,
      configPath: join(configDir, "a11yst.config.ts"),
    },
  );
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("@a11yst/core artifact integration", () => {
  it("persists a bundle with relative JSON refs and absolute returned refs", async () => {
    const configDir = await temporaryDirectory();
    const result = await executeAudit(emptyWebConfig(configDir), {
      artifactAuditId: "empty-web",
      artifactNow,
    });

    expect(result.auditId).toBe("empty-web");
    expect(result.status).toBe("completed");
    expect(result.artifacts).toBeDefined();
    expect(Object.values(result.artifacts ?? {}).every(isAbsolute)).toBe(true);
    await expect(access(result.artifacts!.manifestPath)).resolves.toBeUndefined();
    await expect(access(result.artifacts!.resultsPath)).resolves.toBeUndefined();
    await expect(access(result.artifacts!.latestPath)).resolves.toBeUndefined();
    await expect(access(result.artifacts!.reportPath!)).resolves.toBeUndefined();
    await expect(access(result.artifacts!.markdownPath!)).resolves.toBeUndefined();

    const persisted = await readJson(result.artifacts!.resultsPath);
    expect(persisted.auditId).toBe("empty-web");
    expect(persisted.artifacts).toEqual({
      latestPath: "../../latest.json",
      manifestPath: "manifest.json",
      outputDirectory: ".",
      reportPath: "report/index.html",
      markdownPath: "reports/a11yst.md",
      resultsPath: "results.json",
    });

    const manifest = await readJson(result.artifacts!.manifestPath);
    expect(manifest).toMatchObject({
      schemaVersion: "1",
      auditId: "empty-web",
      createdAt: artifactNow.toISOString(),
      status: "completed",
      configPath: "a11yst.config.ts",
      projectRoot: ".",
      resultsPath: "results.json",
      reportPath: "report/index.html",
      artifactCounts: { screenshots: 0, findings: 0, runs: 0 },
    });
    expect(manifest).not.toHaveProperty("evidenceDirectory");
  });

  it("supports html:false without treating the omitted report as an error", async () => {
    const configDir = await temporaryDirectory();
    const result = await executeAudit(emptyWebConfig(configDir), {
      artifactAuditId: "json-only",
      artifactNow,
      html: false,
      markdown: { enabled: false },
    });

    expect(result.status).toBe("completed");
    expect(result.diagnostics.some((entry) => entry.code === "REPORT_GENERATION_FAILED")).toBe(
      false,
    );
    expect(result.artifacts?.reportPath).toBeUndefined();
    await expect(access(join(result.artifacts!.outputDirectory, "report/index.html"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readJson(result.artifacts!.manifestPath)).not.toHaveProperty("reportPath");
  });

  it("defaults the artifact root to .a11yst/results under the config directory", async () => {
    const configDir = await temporaryDirectory();
    const config = emptyWebConfig(configDir);
    expect(config.outputDir).toBe(".a11yst/results");
    expect(resolveAuditOutputDirectory(config)).toBe(join(configDir, ".a11yst/results"));

    const result = await executeAudit(config, {
      artifactAuditId: "canonical-root",
      artifactNow,
    });
    expect(result.artifacts?.outputDirectory).toBe(
      join(await realpath(join(configDir, ".a11yst/results")), "runs/canonical-root"),
    );
  });

  it("resolves relative and absolute output overrides from the config directory", async () => {
    const configDir = await temporaryDirectory();
    const absoluteOutput = join(await temporaryDirectory(), "absolute-output");

    const relativeResult = await executeAudit(emptyWebConfig(configDir), {
      artifactAuditId: "relative-output",
      artifactNow,
      outputDir: "custom/relative",
      html: false,
      markdown: { enabled: false },
    });
    const absoluteResult = await executeAudit(emptyWebConfig(configDir), {
      artifactAuditId: "absolute-output",
      artifactNow,
      outputDir: absoluteOutput,
      html: false,
      markdown: { enabled: false },
    });

    expect(relativeResult.artifacts?.outputDirectory).toBe(
      join(await realpath(join(configDir, "custom/relative")), "runs/relative-output"),
    );
    expect(absoluteResult.artifacts?.outputDirectory).toBe(
      join(await realpath(absoluteOutput), "runs/absolute-output"),
    );
  });

  it("propagates normalized route metadata without changing the Phase 1 run id", async () => {
    const configDir = await temporaryDirectory();
    const config = validateConfig(
      {
        projects: [
          {
            name: "website",
            platform: "web",
            framework: "html",
            baseUrl: "http://localhost:4173",
            routes: [{ id: "home-route", name: "Home", path: "/" }],
            profiles: ["keyboard"],
            viewports: [{ name: "desktop", width: 1440, height: 900 }],
          },
        ],
      },
      { configDir },
    );
    const plan = createAuditPlan(config);
    const expectedId = buildRunId({
      projectName: "website",
      platform: "web",
      framework: "html",
      profile: "keyboard",
      routePath: "/",
      viewportName: "desktop",
    });

    expect(plan.runs[0]).toMatchObject({
      id: "web::website::html::keyboard::root::desktop",
      routeId: "home-route",
      routeName: "Home",
      route: { id: "home-route", name: "Home", path: "/" },
    });
    expect(plan.runs[0]?.id).toBe(expectedId);

    const emptyResult = await executeAudit(emptyWebConfig(configDir), {
      writeArtifacts: false,
    });
    expect(emptyResult.artifacts).toBeUndefined();
  });

  it("throws a clear operational error when the artifact root is a file", async () => {
    const configDir = await temporaryDirectory();
    const outputFile = join(configDir, "not-a-directory");
    await writeFile(outputFile, "occupied");

    await expect(
      executeAudit(emptyWebConfig(configDir), {
        outputDir: outputFile,
        artifactAuditId: "cannot-write",
      }),
    ).rejects.toThrow("Failed to create audit artifact bundle");
  });

  it("writes deterministic evidence paths without exposing selectors", async () => {
    const outputDir = await temporaryDirectory();
    const writer = createArtifactWriter({
      outputDir,
      auditId: "evidence-paths",
      now: artifactNow,
    });
    const sink = createArtifactEvidenceSink(writer);
    const run: PlannedRun = {
      id: "run",
      projectName: "website",
      platform: "web",
      framework: "html",
      profile: "default",
      routeId: "settings",
      routeName: "Settings",
      route: { id: "settings", name: "Settings", path: "/settings" },
      viewport: { name: "desktop", width: 1440, height: 900 },
    };
    const finding: Finding = {
      id: "logical-finding-id",
      fingerprint: "fingerprint",
      source: "axe",
      ruleId: "button-name",
      title: "Buttons must have discernible text",
      severity: "high",
      projectName: "website",
      profile: "default",
      target: ["#app > button[aria-label='Save']"],
      standards: ["wcag2a"],
    };

    const pagePath = await sink.writeRunScreenshot({ run, data: Buffer.from("page") });
    const findingPath = await sink.writeFindingScreenshot({
      run,
      finding,
      targetIndex: 0,
      data: Buffer.from("finding"),
    });

    expect(pagePath).toBe("evidence/website/settings/default/desktop/page.png");
    expect(findingPath).toBe(
      "evidence/website/settings/default/desktop/finding-logical-finding-id-0.png",
    );
    expect(findingPath).not.toContain(finding.target[0]);
    expect(writer.screenshotCount).toBe(2);
  });

  it("writes deterministic flow evidence paths", async () => {
    const outputDir = await temporaryDirectory();
    const writer = createArtifactWriter({
      outputDir,
      auditId: "flow-evidence-paths",
      now: artifactNow,
    });
    const sink = createFlowEvidenceSink(writer, "Web App");

    const trace: FlowTrace = {
      schemaVersion: "1",
      projectName: "Web App",
      flowId: "checkout/flow",
      flowName: "Checkout",
      profile: "default",
      viewport: "desktop",
      sessionId: "session-1",
      startedAt: artifactNow.toISOString(),
      durationMs: 1,
      status: "completed",
      steps: [],
      checkpoints: [],
      diagnostics: [],
    };
    const tracePath = await sink.writeFlowTrace({
      flowId: "checkout/flow",
      profile: "default",
      viewportName: "desktop",
      data: trace,
    });
    const writeStep = sink.writeStepScreenshot;
    const writeCheckpoint = sink.writeCheckpointScreenshot;
    expect(writeStep).toBeTypeOf("function");
    expect(writeCheckpoint).toBeTypeOf("function");
    const stepPath = await writeStep!({
      flowId: "checkout/flow",
      profile: "default",
      viewportName: "desktop",
      stepIndex: 0,
      action: "click",
      data: Buffer.from("step"),
    });
    const checkpointPath = await writeCheckpoint!({
      flowId: "checkout/flow",
      checkpointId: "review",
      profile: "default",
      viewportName: "desktop",
      data: Buffer.from("checkpoint"),
    });

    expect(tracePath).toBe(
      "evidence/Web-App/flows/checkout-flow/default/desktop/flow-trace.json",
    );
    expect(stepPath).toBe(
      "evidence/Web-App/flows/checkout-flow/default/desktop/steps/001-click/page.png",
    );
    expect(checkpointPath).toBe(
      "evidence/Web-App/flows/checkout-flow/default/desktop/checkpoints/review/page.png",
    );
  });
});
