import { createServer, type Server } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DevServerManager } from "@a11yst/browser";
import { getFreePort } from "../../helpers/net.js";

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolvePromise());
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolvePromise) => server.close(() => resolvePromise()));
}

async function isUp(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return response.status >= 100 && response.status < 600;
  } catch {
    return false;
  }
}

describe("DevServerManager", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  it("reuses an already-running server (reused: true, managed: false) and reports no diagnostics", async () => {
    const port = await getFreePort();
    const server = createServer((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    await listen(server, port);

    try {
      const manager = new DevServerManager();
      const result = await manager.ensureReady({
        rootDir: tmpdir(),
        url: `http://127.0.0.1:${port}`,
        reuseExisting: true,
        startupTimeout: 2000,
      });

      expect(result).toEqual({ reused: true, managed: false });
      expect(manager.diagnostics).toHaveLength(0);
    } finally {
      await close(server);
    }
  });

  it("emits a reuse diagnostic when a server is already up but reuseExisting was not requested", async () => {
    const port = await getFreePort();
    const server = createServer((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    await listen(server, port);

    try {
      const manager = new DevServerManager();
      const result = await manager.ensureReady({
        rootDir: tmpdir(),
        url: `http://127.0.0.1:${port}`,
        reuseExisting: false,
        startupTimeout: 2000,
      });

      expect(result).toEqual({ reused: true, managed: false });
      expect(manager.diagnostics.some((d) => d.code === "DEV_SERVER_REUSED")).toBe(true);
    } finally {
      await close(server);
    }
  });

  it("stop() is a no-op that never kills a reused (foreign) server", async () => {
    const port = await getFreePort();
    const server = createServer((_req, res) => {
      res.writeHead(200);
      res.end("still alive");
    });
    await listen(server, port);

    try {
      const manager = new DevServerManager();
      const url = `http://127.0.0.1:${port}`;
      await manager.ensureReady({
        rootDir: tmpdir(),
        url,
        reuseExisting: true,
        startupTimeout: 2000,
      });

      await manager.stop();

      expect(await isUp(url)).toBe(true);
    } finally {
      await close(server);
    }
  });

  it("throws when noStartServer is set and nothing is listening", async () => {
    const port = await getFreePort();
    const manager = new DevServerManager();

    await expect(
      manager.ensureReady({
        rootDir: tmpdir(),
        url: `http://127.0.0.1:${port}`,
        reuseExisting: true,
        startupTimeout: 1000,
        noStartServer: true,
      }),
    ).rejects.toThrow(/no-start-server|server startup was disabled/i);
  });

  it("throws when nothing is listening and no devServer.command is configured", async () => {
    const port = await getFreePort();
    const manager = new DevServerManager();

    await expect(
      manager.ensureReady({
        rootDir: tmpdir(),
        url: `http://127.0.0.1:${port}`,
        reuseExisting: true,
        startupTimeout: 1000,
      }),
    ).rejects.toThrow(/no devServer\.command/i);
  });

  it("starts a managed server, waits until ready, and stop() actually kills the process", async () => {
    const port = await getFreePort();
    const dir = await mkdtemp(join(tmpdir(), "a11yst-dev-server-"));
    tempDirs.push(dir);
    const scriptPath = join(dir, "server.cjs");
    await writeFile(
      scriptPath,
      `
      const http = require("node:http");
      const port = Number(process.env.A11YST_TEST_DEV_SERVER_PORT);
      const server = http.createServer((req, res) => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("managed");
      });
      server.listen(port, "127.0.0.1");
      `,
      "utf8",
    );

    process.env.A11YST_TEST_DEV_SERVER_PORT = String(port);
    const url = `http://127.0.0.1:${port}`;
    const manager = new DevServerManager();

    try {
      const result = await manager.ensureReady({
        rootDir: dir,
        url,
        command: `node ${JSON.stringify(scriptPath)}`,
        reuseExisting: true,
        startupTimeout: 5000,
      });

      expect(result).toEqual({ reused: false, managed: true });
      expect(await isUp(url)).toBe(true);

      await manager.stop();

      expect(await isUp(url)).toBe(false);
    } finally {
      delete process.env.A11YST_TEST_DEV_SERVER_PORT;
    }
  }, 10_000);

  it("throws a clear error when the managed command exits before becoming ready", async () => {
    const port = await getFreePort();
    const manager = new DevServerManager();

    await expect(
      manager.ensureReady({
        rootDir: tmpdir(),
        url: `http://127.0.0.1:${port}`,
        command: process.platform === "win32" ? "cmd /c exit 1" : "exit 1",
        reuseExisting: true,
        startupTimeout: 3000,
      }),
    ).rejects.toThrow(/exited early/i);
  }, 10_000);
});
