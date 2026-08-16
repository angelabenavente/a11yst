import { spawn, type ChildProcess } from "node:child_process";
import { cp, readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "@a11yst/config";
import { executeAudit, type ExecuteAuditOptions } from "@a11yst/core";
import type { AuditExecutionResult } from "@a11yst/types";
import { repoRoot } from "./cli.js";
import { getFreePort } from "./net.js";

export const BASELINE_EXAMPLES = {
  legacyHtml: "examples/baseline/legacy-html",
  reactRegression: "examples/baseline/react-regression",
  flowRegression: "examples/baseline/flow-regression",
  classificationExpiry: "examples/baseline/classification-expiry",
  mixedWorkspace: "examples/baseline/mixed-workspace",
} as const;

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.status >= 100 && response.status < 600) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

export async function copyBaselineExample(
  exampleRelativePath: string,
  targetDir: string,
): Promise<string> {
  const source = join(repoRoot, exampleRelativePath);
  for (const entry of await readdir(source)) {
    if (entry === "node_modules") continue;
    await cp(join(source, entry), join(targetDir, entry), { recursive: true });
  }
  return targetDir;
}

export async function withBaselineExamplePort<T>(
  fn: (port: number) => Promise<T>,
): Promise<T> {
  const port = await getFreePort();
  const previousPort = process.env.PORT;
  process.env.PORT = String(port);
  try {
    return await fn(port);
  } finally {
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }
  }
}

export async function runBaselineExampleAudit(
  exampleRelativePath: string,
  options: ExecuteAuditOptions = {},
): Promise<AuditExecutionResult> {
  return withBaselineExamplePort(async () => {
    const config = await loadConfig({
      cwd: join(repoRoot, exampleRelativePath),
    });
    return executeAudit(config, options);
  });
}

export async function startReactRegressionServer(
  port: number,
  timeoutMs = 120_000,
): Promise<{ stop: () => Promise<void> }> {
  const exampleDir = join(repoRoot, BASELINE_EXAMPLES.reactRegression);
  const url = `http://127.0.0.1:${port}`;
  const child: ChildProcess = spawn(
    "pnpm",
    ["exec", "vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: exampleDir,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  try {
    await waitForServer(url, timeoutMs);
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }

  return {
    stop: async () => {
      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5000);
      });
    },
  };
}

export async function withReactRegressionServer<T>(
  fn: (port: number) => Promise<T>,
  timeoutMs = 120_000,
): Promise<T> {
  const port = await getFreePort();
  const previousPort = process.env.PORT;
  process.env.PORT = String(port);
  const { stop } = await startReactRegressionServer(port, timeoutMs);
  try {
    return await fn(port);
  } finally {
    await stop();
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }
  }
}

export async function runReactRegressionAudit(
  options: ExecuteAuditOptions = {},
): Promise<AuditExecutionResult> {
  const port = await getFreePort();
  const previousPort = process.env.PORT;
  process.env.PORT = String(port);
  const { stop } = await startReactRegressionServer(port);
  try {
    const config = await loadConfig({
      cwd: join(repoRoot, BASELINE_EXAMPLES.reactRegression),
    });
    return await executeAudit(config, {
      writeArtifacts: false,
      html: false,
      noStartServer: true,
      ...options,
    });
  } finally {
    await stop();
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }
  }
}
