#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDemoSummary,
  renderDemoHeader,
  renderDemoSummary,
  renderDemoSummaryMarkdown,
  renderStageProgress,
  resolveDemoOutputRoot,
  resolveReportLocations,
} from "./presentation/index.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const demoRoot = resolve(scriptDir, "..");

function resolveCliBin() {
  if (process.env.A11YST_CLI_BIN) {
    return resolve(process.env.A11YST_CLI_BIN);
  }

  let dir = demoRoot;
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(dir, "packages/cli/dist/bin.js");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return join(resolve(demoRoot, "../../.."), "packages/cli/dist/bin.js");
}

const cliBin = resolveCliBin();

const ALLOWED_COMMANDS = new Set(["baseline", "current", "full", "clean", "help"]);

function printHelp() {
  process.stdout.write(`a11yst Shop demo runner

Usage:
  node scripts/demo.mjs baseline   Run baseline-stage audit and create baseline
  node scripts/demo.mjs current    Run current-stage audit (policy may exit 2)
  node scripts/demo.mjs full       baseline -> create baseline -> current audit -> summary
  node scripts/demo.mjs clean      Remove generated .a11yst artifacts
  node scripts/demo.mjs help       Show this help

From repository root:
  pnpm demo full
`);
}

function runCli(args, env = {}) {
  return spawnSync(process.execPath, [cliBin, ...args], {
    cwd: demoRoot,
    env: {
      ...process.env,
      NO_COLOR: "1",
      ...env,
    },
    encoding: "utf8",
    shell: false,
  });
}

function failOperational(message) {
  process.stderr.write(`Demo failed: ${message}\n`);
  process.exit(1);
}

async function cleanArtifacts() {
  const outputRoot = resolveDemoOutputRoot(demoRoot);
  await rm(outputRoot, { recursive: true, force: true });
}

async function readLatestResults() {
  const latestPath = join(demoRoot, ".a11yst/results/latest.json");
  const latest = JSON.parse(await readFile(latestPath, "utf8"));
  const resultsPath = join(demoRoot, ".a11yst/results", latest.resultsPath);
  const runDir = join(resultsPath, "..");
  const results = JSON.parse(await readFile(resultsPath, "utf8"));
  return { runDir, results };
}

async function writePresentationSummary(results, policyExitCode) {
  const summary = createDemoSummary(results, policyExitCode);
  const reportLocations = resolveReportLocations(demoRoot, results.runDir ?? "", results);
  const demoSummaryDir = join(demoRoot, ".a11yst/demo");
  await mkdir(demoSummaryDir, { recursive: true });
  await writeFile(
    join(demoSummaryDir, "demo-summary.md"),
    renderDemoSummaryMarkdown(summary, reportLocations),
    "utf8",
  );
  return { summary, reportLocations };
}

async function presentResults(results, policyExitCode, runDir) {
  const summary = createDemoSummary(results, policyExitCode);
  const reportLocations = resolveReportLocations(demoRoot, runDir, results);
  process.stdout.write(renderDemoSummary(summary, reportLocations));
  await mkdir(join(demoRoot, ".a11yst/demo"), { recursive: true });
  await writeFile(
    join(demoRoot, ".a11yst/demo/demo-summary.md"),
    renderDemoSummaryMarkdown(summary, reportLocations),
    "utf8",
  );
}

async function runBaselineStage() {
  const audit = runCli(["audit", "--json"], { A11YST_DEMO_STAGE: "baseline" });
  if (audit.status !== 0) {
    process.stderr.write(audit.stdout);
    process.stderr.write(audit.stderr);
    failOperational(`baseline audit exited with code ${audit.status ?? "unknown"}`);
  }

  const create = runCli(["baseline", "create", "--force"], {
    A11YST_DEMO_STAGE: "baseline",
  });
  if (create.status !== 0) {
    process.stderr.write(create.stdout);
    process.stderr.write(create.stderr);
    failOperational(`baseline create exited with code ${create.status ?? "unknown"}`);
  }
}

async function runCurrentStage() {
  const audit = runCli(["audit", "--json"], { A11YST_DEMO_STAGE: "current" });
  if (audit.status !== 0 && audit.status !== 2) {
    process.stderr.write(audit.stdout);
    process.stderr.write(audit.stderr);
    failOperational(`current audit exited with code ${audit.status ?? "unknown"}`);
  }
  return audit.status ?? 0;
}

async function main() {
  const command = process.argv[2] ?? "help";
  if (!ALLOWED_COMMANDS.has(command)) {
    process.stderr.write(`Unknown demo command "${command}".\n\n`);
    printHelp();
    process.exit(1);
  }

  if (command === "help") {
    printHelp();
    return;
  }

  if (command === "clean") {
    await cleanArtifacts();
    process.stdout.write("Removed demo artifacts under .a11yst/\n");
    return;
  }

  if (command === "baseline") {
    process.stdout.write(renderDemoHeader());
    process.stdout.write(renderStageProgress("[1/2] Preparing baseline audit"));
    await cleanArtifacts();
    process.stdout.write(renderStageProgress("[2/2] Running baseline audit and creating baseline"));
    await runBaselineStage();
    process.stdout.write("\nBaseline stage complete.\n");
    return;
  }

  if (command === "current") {
    process.stdout.write(renderDemoHeader());
    process.stdout.write(renderStageProgress("[1/1] Running current audit"));
    const exitCode = await runCurrentStage();
    const { runDir, results } = await readLatestResults();
    await presentResults(results, exitCode, runDir);
    if (exitCode === 2) {
      process.stdout.write(
        "Configured policy breach detected on current audit (exit 2).\n",
      );
    }
    process.exit(exitCode === 2 ? 2 : 0);
  }

  if (command === "full") {
    process.stdout.write(renderDemoHeader());
    process.stdout.write(renderStageProgress("[1/4] Preparing baseline"));
    await cleanArtifacts();
    process.stdout.write(renderStageProgress("[2/4] Running baseline audit"));
    await runBaselineStage();
    process.stdout.write(renderStageProgress("[3/4] Running current audit"));
    const policyExit = await runCurrentStage();
    process.stdout.write(renderStageProgress("[4/4] Building demo summary"));
    const { runDir, results } = await readLatestResults();
    await presentResults(results, policyExit, runDir);
    if (policyExit === 2) {
      process.stdout.write(
        "Configured policy breach detected on current audit (exit 2).\n",
      );
    }
    process.exit(0);
  }
}

main().catch((error) => {
  failOperational(error instanceof Error ? error.message : String(error));
});
