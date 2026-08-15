import { createServer, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import { validateConfig } from "@a11yst/config";
import { executeAudit } from "@a11yst/core";
import { getFreePort } from "../../helpers/net.js";

const TEST_TIMEOUT_MS = 90_000;

function configuredAppHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head><title>configured-target</title></head>
  <body data-dogfood-app="configured-target">
    <select id="role"></select>
  </body>
</html>`;
}

function decoyAppHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head><title>decoy-target</title></head>
  <body data-dogfood-app="decoy-target">
    <button></button>
  </body>
</html>`;
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

function startHtmlServer(html: string, port: number): Promise<Server> {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  return listen(server, port).then(() => server);
}

function buildHtmlProjectConfig(baseUrl: string) {
  return validateConfig(
    {
      projects: [
        {
          name: "dogfood-target",
          platform: "web",
          framework: "html",
          baseUrl,
          devServer: {
            url: baseUrl,
            reuseExisting: true,
          },
          routes: [{ id: "home", path: "/", name: "Home" }],
          profiles: ["default"],
          viewports: [{ name: "desktop", width: 1280, height: 720 }],
        },
      ],
    },
    { configDir: process.cwd() },
  );
}

describe.sequential("configured target is authoritative", () => {
  it(
    "audits only the configured origin when a decoy app runs on another port",
    async () => {
      const configuredPort = await getFreePort();
      const decoyPort = await getFreePort();
      const configuredUrl = `http://127.0.0.1:${configuredPort}`;

      const configuredServer = await startHtmlServer(configuredAppHtml(), configuredPort);
      const decoyServer = await startHtmlServer(decoyAppHtml(), decoyPort);

      try {
        const config = buildHtmlProjectConfig(configuredUrl);
        const result = await executeAudit(config, { writeArtifacts: false, headed: false });

        expect(result.summary.failedRuns).toBe(0);
        expect(result.runs).toHaveLength(1);
        const run = result.runs[0]!;
        expect(run.status).toBe("completed");
        expect(run.url).toMatch(new RegExp(`^${configuredUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
        expect(run.evidence?.documentTitle).toBe("configured-target");

        const ruleIds = result.findings.map((finding) => finding.ruleId);
        expect(ruleIds).toContain("select-name");
        expect(ruleIds).not.toContain("button-name");
      } finally {
        await close(configuredServer);
        await close(decoyServer);
      }
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "does not reuse a decoy server when the configured URL is not responding",
    async () => {
      const configuredPort = await getFreePort();
      const decoyPort = await getFreePort();
      const configuredUrl = `http://127.0.0.1:${configuredPort}`;
      const decoyUrl = `http://127.0.0.1:${decoyPort}`;

      const decoyServer = await startHtmlServer(decoyAppHtml(), decoyPort);

      try {
        const config = buildHtmlProjectConfig(configuredUrl);
        const result = await executeAudit(config, { writeArtifacts: false, headed: false });

        expect(result.summary.failedRuns).toBeGreaterThan(0);
        expect(result.runs[0]?.status).toBe("failed");
        expect(result.runs[0]?.findings ?? []).toHaveLength(0);
        expect(result.findings.map((finding) => finding.ruleId)).not.toContain("button-name");

        const messages = [
          result.runs[0]?.skipReason ?? "",
          ...result.diagnostics.map((diagnostic) => diagnostic.message),
        ].join("\n");
        expect(messages).toMatch(/127\.0\.0\.1|not ready|No server responding/i);
        expect(decoyUrl).not.toEqual(configuredUrl);
      } finally {
        await close(decoyServer);
      }
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "fails with TARGET_ORIGIN_MISMATCH when navigation crosses to another origin",
    async () => {
      const configuredPort = await getFreePort();
      const decoyPort = await getFreePort();
      const configuredUrl = `http://127.0.0.1:${configuredPort}`;
      const decoyUrl = `http://127.0.0.1:${decoyPort}`;

      const decoyServer = await startHtmlServer(decoyAppHtml(), decoyPort);
      const redirectServer = createServer((req, res) => {
        if (req.url === "/" || req.url === "") {
          res.writeHead(302, { Location: `${decoyUrl}/` });
          res.end();
          return;
        }
        res.writeHead(404).end();
      });
      await listen(redirectServer, configuredPort);

      try {
        const config = buildHtmlProjectConfig(configuredUrl);
        const result = await executeAudit(config, { writeArtifacts: false, headed: false });

        expect(result.runs[0]?.status).toBe("failed");
        expect(result.runs[0]?.findings ?? []).toHaveLength(0);
        expect(result.summary.failedRuns).toBeGreaterThan(0);

        const diagnosticCodes = [
          ...(result.runs[0]?.diagnostics ?? []).map((diagnostic) => diagnostic.code),
          ...result.diagnostics.map((diagnostic) => diagnostic.code),
        ];
        expect(diagnosticCodes).toContain("TARGET_ORIGIN_MISMATCH");
        expect(result.findings.map((finding) => finding.ruleId)).not.toContain("button-name");
      } finally {
        await close(redirectServer);
        await close(decoyServer);
      }
    },
    TEST_TIMEOUT_MS,
  );
});
