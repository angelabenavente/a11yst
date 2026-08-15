import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot, runCli, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const TEST_TIMEOUT_MS = 60_000;

const emptyWebConfig = `export default {
  projects: [
    {
      name: "empty",
      platform: "web",
      framework: "html",
      baseUrl: "http://127.0.0.1:9",
      rootDir: ".",
      routeDiscovery: { mode: "fallback" },
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
};
`;

const invalidConfig = `export default {
  projects: [
    {
      name: "broken",
      platform: "web",
      routes: ["/"],
    },
  ],
};
`;

function downWebConfig(port: number): string {
  return `export default {
  projects: [
    {
      name: "down-site",
      platform: "web",
      framework: "html",
      baseUrl: "http://127.0.0.1:${port}",
      routes: ["/"],
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
};
`;
}

async function runExampleAudit(
  example: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
) {
  return withTempDir("a11yst-audit-output-", (output) =>
    runCli(["audit", ...args, "--output", output], {
      cwd: join(repoRoot, "examples/audit", example),
      env,
    }),
  );
}

describe.sequential("CLI audit integration (real Chromium + axe-core)", () => {
  it(
    "html-accessible: exits 0 and human output carries the accessibility disclaimer",
    async () => {
      const port = await getFreePort();
      const result = await runExampleAudit("html-accessible", [], {
        PORT: String(port),
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/do not establish accessibility conformance/i);
      expect(result.stdout).toMatch(/manual review/i);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "html-inaccessible --json: exits 0 even though findings were reported, and ruleIds are present",
    async () => {
      const port = await getFreePort();
      const result = await runExampleAudit("html-inaccessible", ["--json"], {
        PORT: String(port),
      });

      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        status: string;
        summary: { findingCount: number };
        findings: Array<{ ruleId: string }>;
      };
      expect(payload.status).toBe("completed");
      expect(payload.summary.findingCount).toBeGreaterThan(0);
      const ruleIds = payload.findings.map((f) => f.ruleId);
      expect(ruleIds).toContain("button-name");
      expect(ruleIds).toContain("image-alt");
      expect(ruleIds).toContain("label");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "react-inaccessible: keyboard and default profiles complete, exit 0",
    async () => {
      // Fixed port by design (see examples/audit/react-inaccessible/README.md).
      const result = await runExampleAudit("react-inaccessible", ["--json"]);

      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        status: string;
        runs: Array<{ profile: string; status: string }>;
      };
      expect(payload.status).toBe("completed");
      const keyboardRuns = payload.runs.filter((r) => r.profile === "keyboard");
      const defaultRuns = payload.runs.filter((r) => r.profile === "default");
      expect(keyboardRuns.length).toBeGreaterThan(0);
      expect(keyboardRuns.every((r) => r.status === "completed")).toBe(true);
      expect(defaultRuns.length).toBeGreaterThan(0);
      expect(defaultRuns.every((r) => r.status === "completed")).toBe(true);
    },
    360_000,
  );

  it("invalid config: exits 1 before ever touching a browser", async () => {
    await withTempDir("a11yst-audit-cli-invalid-", async (dir) => {
      await writeFile(join(dir, "a11yst.config.mjs"), invalidConfig, "utf8");
      const result = await runCli(["audit"], { cwd: dir });
      expect(result.code).toBe(1);
      expect(result.stderr.length).toBeGreaterThan(0);
    });
  });

  it(
    "unknown --project: exits 1 as an operational/config failure",
    async () => {
      const port = await getFreePort();
      const result = await runExampleAudit(
        "html-accessible",
        ["--json", "--project", "does-not-exist"],
        { PORT: String(port) },
      );

      expect(result.code).toBe(1);
      const payload = JSON.parse(result.stdout) as { status: string };
      expect(payload.status).toBe("failed");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "--no-start-server against a down URL: exits 1",
    async () => {
      await withTempDir("a11yst-audit-cli-down-", async (dir) => {
        const port = await getFreePort();
        await writeFile(join(dir, "a11yst.config.mjs"), downWebConfig(port), "utf8");
        const result = await runCli(["audit", "--json", "--no-start-server"], { cwd: dir });
        expect(result.code).toBe(1);
        const payload = JSON.parse(result.stdout) as { status: string };
        expect(payload.status).toBe("failed");
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "NO_COLOR=1 output never contains ANSI escape codes",
    async () => {
      const port = await getFreePort();
      const result = await runExampleAudit("html-accessible", [], {
        PORT: String(port),
        NO_COLOR: "1",
      });
      expect(result.code).toBe(0);
      // eslint-disable-next-line no-control-regex
      expect(result.stdout).not.toMatch(/\x1b\[[0-9;]*m/);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "--json produces stdout that is pure, parseable JSON (no banner/log noise mixed in)",
    async () => {
      const port = await getFreePort();
      const result = await runExampleAudit("html-accessible", ["--json"], {
        PORT: String(port),
      });

      expect(result.code).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
      const payload = JSON.parse(result.stdout) as { schemaVersion: string };
      expect(payload.schemaVersion).toBe("1");
    },
    TEST_TIMEOUT_MS,
  );

  it("passes artifact flags through core without launching a browser", async () => {
    await withTempDir("a11yst-audit-cli-flags-", async (dir) => {
      await writeFile(join(dir, "a11yst.config.mjs"), emptyWebConfig, "utf8");
      const result = await runCli(
        [
          "audit",
          "--json",
          "--output",
          "custom output",
          "--no-screenshots",
          "--full-page-screenshots",
        ],
        { cwd: dir },
      );

      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        auditId: string;
        artifacts: { resultsPath: string; reportPath?: string };
      };
      expect(payload.auditId).toBeTruthy();
      expect(payload.artifacts.resultsPath).toContain("custom output");
      expect(payload.artifacts.reportPath).toBeUndefined();

      const human = await runCli(
        ["audit", "--output", "human output"],
        { cwd: dir },
      );
      expect(human.code).toBe(0);
      expect(human.stdout).toMatch(/Audit ID: \S+/);
      expect(human.stdout).toMatch(/JSON report: .*results\.json/);
    });
  });
});
