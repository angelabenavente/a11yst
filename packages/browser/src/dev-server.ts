import { spawn, type ChildProcess } from "node:child_process";
import type { Diagnostic } from "@a11yst/types";

const RING_BUFFER_LINES = 50;
const PROBE_TIMEOUT_MS = 2_000;
const POLL_INTERVAL_MS = 300;
const STOP_GRACE_PERIOD_MS = 3_000;

export interface EnsureReadyOptions {
  /** Absolute project root, used as the spawned command's cwd. */
  rootDir: string;
  /** URL to probe/wait on. */
  url: string;
  /** Shell command that starts the dev server, if one needs to be started. */
  command?: string;
  /** Prefer an already-running server over starting a new one. */
  reuseExisting: boolean;
  /** Milliseconds to wait for the server to start responding. */
  startupTimeout: number;
  /** Never start a server; fail if nothing is already listening. */
  noStartServer?: boolean;
  signal?: AbortSignal;
}

export interface EnsureReadyResult {
  /** True when an already-running server was used instead of starting one. */
  reused: boolean;
  /** True when this manager spawned the server and owns its lifecycle. */
  managed: boolean;
}

/** Small fixed-size ring buffer used to keep the tail of process output for error messages. */
class RingBuffer {
  private lines: string[] = [];

  constructor(private readonly limit: number) {}

  push(chunk: string): void {
    const newLines = chunk.split(/\r?\n/).filter((line) => line.length > 0);
    if (newLines.length === 0) {
      return;
    }
    this.lines.push(...newLines);
    if (this.lines.length > this.limit) {
      this.lines.splice(0, this.lines.length - this.limit);
    }
  }

  toString(): string {
    return this.lines.join("\n");
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
    signal?.addEventListener("abort", onAbort);
  });
}

/**
 * Probe a URL to see whether *something* is responding.
 *
 * Any HTTP response (2xx through 5xx) counts as "up" — we only care whether
 * a server accepted the connection, not whether the app itself is healthy.
 * Connection errors (refused, DNS failure, timeout) count as "down".
 */
async function probeUrl(url: string, signal?: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    return response.status >= 100 && response.status < 600;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

/**
 * Ensures a web project's dev server is reachable for the duration of an
 * audit, starting it if necessary and stopping it afterwards.
 *
 * This module is only ever imported from the audit execution path
 * (`run-web-audit.ts`) — it must never run during `detect`/`init`/`doctor`.
 */
export class DevServerManager {
  private child: ChildProcess | undefined;
  private managed = false;
  private readonly stdout = new RingBuffer(RING_BUFFER_LINES);
  private readonly stderr = new RingBuffer(RING_BUFFER_LINES);
  private readonly collectedDiagnostics: Diagnostic[] = [];

  /** Diagnostics collected while ensuring the server was ready (e.g. reuse notices). */
  get diagnostics(): readonly Diagnostic[] {
    return this.collectedDiagnostics;
  }

  async ensureReady(opts: EnsureReadyOptions): Promise<EnsureReadyResult> {
    throwIfAborted(opts.signal);

    const up = await probeUrl(opts.url, opts.signal);
    throwIfAborted(opts.signal);

    if (up) {
      if (!opts.reuseExisting) {
        this.collectedDiagnostics.push({
          code: "DEV_SERVER_REUSED",
          severity: "info",
          message: `A server was already responding at ${opts.url}; reusing it instead of starting a new one.`,
          hint: "a11yst never stops a server it did not start. Set devServer.reuseExisting to true to make this explicit.",
        });
      }
      return { reused: true, managed: false };
    }

    if (opts.noStartServer) {
      throw new Error(
        `No server responding at ${opts.url}, and server startup was disabled (--no-start-server). ` +
          "Start the dev server manually before running the audit, or remove --no-start-server.",
      );
    }

    if (!opts.command) {
      throw new Error(
        `No server responding at ${opts.url}, and no devServer.command is configured to start one.`,
      );
    }

    await this.spawnServer(opts);
    await this.waitUntilReady(opts);
    return { reused: false, managed: true };
  }

  /**
   * Stop the server this manager started, if any. A no-op when the server
   * was reused (not managed) or already stopped — safe to call multiple
   * times, including from a SIGINT/SIGTERM handler.
   */
  async stop(): Promise<void> {
    if (!this.managed || !this.child) {
      return;
    }
    const child = this.child;
    this.child = undefined;
    this.managed = false;

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      child.once("exit", finish);

      if (!trySignal(child, "SIGTERM")) {
        finish();
        return;
      }

      const killTimer = setTimeout(() => {
        if (settled) return;
        trySignal(child, "SIGKILL");
        finish();
      }, STOP_GRACE_PERIOD_MS);
      child.once("exit", () => clearTimeout(killTimer));
    });
  }

  private async spawnServer(opts: EnsureReadyOptions): Promise<void> {
    // `shell: true` lets users configure arbitrary shell commands (e.g.
    // `npm run dev`) without a11yst parsing argv itself. `detached` (POSIX
    // only) puts the command in its own process group so `stop()` can kill
    // the whole tree, not just the shell.
    const child = spawn(opts.command as string, {
      cwd: opts.rootDir,
      shell: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    this.child = child;
    // Mark managed immediately: if the server never becomes ready and we
    // throw below, the caller's `finally { stop() }` must still be able to
    // clean up this process. `ensureReady`'s *return value* only reports
    // `managed: true` once startup actually succeeds.
    this.managed = true;

    child.stdout?.on("data", (chunk: Buffer) => this.stdout.push(chunk.toString("utf8")));
    child.stderr?.on("data", (chunk: Buffer) => this.stderr.push(chunk.toString("utf8")));
  }

  private async waitUntilReady(opts: EnsureReadyOptions): Promise<void> {
    const child = this.child;
    let exitInfo: { code: number | null; signal: NodeJS.Signals | null } | undefined;
    child?.once("exit", (code, signal) => {
      exitInfo = { code, signal };
    });

    const deadline = Date.now() + opts.startupTimeout;
    for (;;) {
      throwIfAborted(opts.signal);

      if (exitInfo) {
        throw new Error(
          `Dev server command exited early (code=${exitInfo.code ?? "null"}, signal=${
            exitInfo.signal ?? "null"
          }) before ${opts.url} responded to requests.\n${this.formatOutputTail()}`,
        );
      }

      if (await probeUrl(opts.url, opts.signal)) {
        return;
      }

      if (Date.now() >= deadline) {
        throw new Error(
          `Timed out after ${opts.startupTimeout}ms waiting for the dev server at ${opts.url} to respond.\n${this.formatOutputTail()}`,
        );
      }

      await delay(POLL_INTERVAL_MS, opts.signal);
    }
  }

  private formatOutputTail(): string {
    const stdout = this.stdout.toString();
    const stderr = this.stderr.toString();
    const parts: string[] = [];
    if (stdout) {
      parts.push(`--- stdout (last ${RING_BUFFER_LINES} lines) ---\n${stdout}`);
    }
    if (stderr) {
      parts.push(`--- stderr (last ${RING_BUFFER_LINES} lines) ---\n${stderr}`);
    }
    return parts.join("\n");
  }
}

/**
 * Send a signal to a spawned child's process group (POSIX) or the process
 * itself (Windows, best-effort — Windows has no equivalent of POSIX process
 * groups for arbitrary shells, so orphaned grandchildren are possible).
 * Returns false if the process/group was already gone.
 */
function trySignal(child: ChildProcess, signal: NodeJS.Signals): boolean {
  try {
    if (process.platform !== "win32" && typeof child.pid === "number") {
      process.kill(-child.pid, signal);
    } else if (typeof child.pid === "number") {
      child.kill(signal);
    }
    return true;
  } catch {
    return false;
  }
}
