import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { getFreePort } from "./net.js";
import { repoRoot } from "./cli.js";

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

export interface FlowExampleServer {
  port: number;
  url: string;
}

export async function startFlowExampleServer(
  exampleRelativePath: string,
  timeoutMs = 120_000,
): Promise<{ server: FlowExampleServer; stop: () => Promise<void> }> {
  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;
  const exampleDir = join(repoRoot, exampleRelativePath);
  const previousPort = process.env.PORT;
  process.env.PORT = String(port);

  const child: ChildProcess = spawn("node", ["serve.mjs"], {
    cwd: exampleDir,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServer(url, timeoutMs);
  } catch (error) {
    child.kill("SIGTERM");
    if (previousPort === undefined) delete process.env.PORT;
    else process.env.PORT = previousPort;
    throw error;
  }

  return {
    server: { port, url },
    stop: async () => {
      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5000);
      });
      if (previousPort === undefined) delete process.env.PORT;
      else process.env.PORT = previousPort;
    },
  };
}

export async function withFlowExampleServer<T>(
  exampleRelativePath: string,
  fn: (server: FlowExampleServer) => Promise<T>,
  timeoutMs = 120_000,
): Promise<T> {
  const { server, stop } = await startFlowExampleServer(exampleRelativePath, timeoutMs);
  try {
    return await fn(server);
  } finally {
    await stop();
  }
}
