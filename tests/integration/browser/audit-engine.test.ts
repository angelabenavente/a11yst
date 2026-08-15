import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, validateConfig } from "@a11yst/config";
import { executeAudit } from "@a11yst/core";
import { repoRoot } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

/**
 * These tests drive the real Playwright + axe-core engine (`executeAudit`)
 * against the small local apps in `examples/audit/*`. No internet access is
 * used: every server is either started locally by the audit engine itself
 * (via `devServer.command`) or created in-process for this test file.
 *
 * They are grouped in a single non-concurrent `describe` and given a longer
 * timeout because each case launches Chromium and/or a real dev server.
 */
const TEST_TIMEOUT_MS = 90_000;

/**
 * Load an example's config AND run the audit while `process.env.PORT` is
 * set, then restore it. This matters because `PORT` is read twice: once by
 * the config file itself (to compute `baseUrl`) when `loadConfig` imports
 * it, and again by the example's own `serve.mjs`/`vite` dev command (via
 * `DevServerManager`, which spawns with `env: process.env`) once
 * `executeAudit` actually starts the server. Restoring `PORT` too early
 * (e.g. right after `loadConfig`) would make the spawned dev server fall
 * back to its hardcoded default port instead of the dynamic one baked into
 * `baseUrl`.
 */
async function runExampleAudit(
  exampleDirName: string,
  port: number,
  options?: Parameters<typeof executeAudit>[1],
) {
  const exampleDir = join(repoRoot, "examples/audit", exampleDirName);
  const previousPort = process.env.PORT;
  process.env.PORT = String(port);
  try {
    const config = await loadConfig({ cwd: exampleDir });
    return await executeAudit(config, {
      writeArtifacts: false,
      ...options,
    });
  } finally {
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }
  }
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolvePromise());
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolvePromise) => server.close(() => resolvePromise()));
}

describe.sequential("browser audit engine (real Chromium + axe-core)", () => {
  it(
    "html-accessible: completes with zero findings",
    async () => {
      const port = await getFreePort();
      const result = await runExampleAudit("html-accessible", port);

      expect(result.schemaVersion).toBe("1");
      expect(result.status).toBe("completed");
      expect(result.summary.completedRuns).toBeGreaterThanOrEqual(1);
      expect(result.summary.failedRuns).toBe(0);
      expect(result.summary.findingCount).toBe(0);
      const ruleIds = result.findings.map((f) => f.ruleId);
      expect(ruleIds).not.toContain("button-name");
      expect(ruleIds).not.toContain("image-alt");
      expect(ruleIds).not.toContain("label");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "html-inaccessible: reports button-name, image-alt, and label violations (and the result is JSON-serialisable)",
    async () => {
      const port = await getFreePort();
      const result = await runExampleAudit("html-inaccessible", port);

      expect(result.status).toBe("completed");
      expect(result.summary.failedRuns).toBe(0);

      const ruleIds = result.findings.map((f) => f.ruleId);
      expect(ruleIds).toContain("button-name");
      expect(ruleIds).toContain("image-alt");
      expect(ruleIds).toContain("label");
      expect(result.summary.findingCount).toBeGreaterThanOrEqual(3);

      // Piggy-back the JSON-serialisability check on this run instead of
      // launching a whole extra audit just for it.
      const roundTripped: unknown = JSON.parse(JSON.stringify(result));
      expect(roundTripped).toEqual(result);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "react-inaccessible: runs default and keyboard profiles and finds button-name on /broken",
    async () => {
      // vite.config.ts and a11yst.config.ts both fix this example's port at
      // 5177 by design (see examples/audit/react-inaccessible/README.md).
      const result = await runExampleAudit("react-inaccessible", 5177);

      expect(result.summary.failedRuns).toBe(0);
      expect(result.plan.totalRuns).toBe(4); // 2 routes x 2 profiles x 1 viewport

      const defaultRuns = result.runs.filter((run) => run.profile === "default");
      const keyboardRuns = result.runs.filter((run) => run.profile === "keyboard");

      expect(defaultRuns).toHaveLength(2);
      expect(defaultRuns.every((run) => run.status === "completed")).toBe(true);

      expect(keyboardRuns).toHaveLength(2);
      expect(keyboardRuns.every((run) => run.status === "completed")).toBe(true);

      const brokenRun = defaultRuns.find((run) => run.route === "/broken");
      expect(brokenRun).toBeDefined();
      expect(brokenRun?.findings.some((f) => f.ruleId === "button-name")).toBe(true);
    },
    180_000,
  );

  it(
    "audits an in-process HTML server without starting a second listener",
    async () => {
      const port = await getFreePort();
      const server = createServer((req, res) => {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end("<!doctype html><html lang=\"en\"><head><title>Mixed</title></head><body><h1>Mixed config fixture</h1></body></html>");
      });
      await listen(server, port);

      try {
        const config = validateConfig({
          projects: [
            {
              name: "static-site",
              platform: "web",
              framework: "html",
              baseUrl: `http://127.0.0.1:${port}`,
              routes: ["/"],
              profiles: ["default"],
              viewports: [{ name: "desktop", width: 1440, height: 900 }],
            },
          ],
        });

        const result = await executeAudit(config, { writeArtifacts: false });

        const webRuns = result.runs.filter((run) => run.platform === "web");

        expect(webRuns).toHaveLength(1);
        expect(webRuns[0]?.status).toBe("completed");
      } finally {
        await close(server);
      }
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "--no-start-server (noStartServer) fails fast when nothing is listening",
    async () => {
      const port = await getFreePort();
      const config = validateConfig({
        projects: [
          {
            name: "down-site",
            platform: "web",
            framework: "html",
            baseUrl: `http://127.0.0.1:${port}`,
            routes: ["/"],
            profiles: ["default"],
            viewports: [{ name: "desktop", width: 1440, height: 900 }],
          },
        ],
      });

      const result = await executeAudit(config, {
        noStartServer: true,
        writeArtifacts: false,
      });

      expect(result.status).toBe("failed");
      expect(result.summary.completedRuns).toBe(0);
      expect(result.summary.failedRuns).toBeGreaterThanOrEqual(1);
      expect(
        result.diagnostics.some((d) => d.code === "DEV_SERVER_NOT_READY"),
      ).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

});
