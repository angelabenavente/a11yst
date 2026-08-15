import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot, runCli, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const TEST_TIMEOUT_MS = 180_000;

describe.sequential("CLI audit flow integration", () => {
  it(
    "html-dialog --flows-only exits 0 with FLOW output and findings",
    async () => {
      const port = await getFreePort();
      const result = await runCli(
        ["audit", "--cwd", join(repoRoot, "examples/flows/html-dialog"), "--flows-only"],
        { env: { PORT: String(port) } },
      );
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/^FLOW {2}/m);
      expect(result.stdout).toMatch(/^CHECKPOINT {2}/m);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "react-checkout --flow open-cart --profile large-text includes internal reference in JSON",
    async () => {
      const port = await getFreePort();
      const result = await withTempDir("a11yst-flow-json-", async (output) =>
        runCli(
          [
            "audit",
            "--cwd",
            join(repoRoot, "examples/flows/react-checkout"),
            "--flow",
            "open-cart",
            "--profile",
            "large-text",
            "--json",
            "--output",
            output,
          ],
          { env: { PORT: String(port) } },
        ),
      );
      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        runs: Array<{ profileMetadata?: { internalReferenceProfile?: string } }>;
      };
      expect(
        payload.runs.some(
          (run) => run.profileMetadata?.internalReferenceProfile === "default",
        ),
      ).toBe(true);
      // eslint-disable-next-line no-control-regex
      expect(result.stdout).not.toMatch(/\u001b\[/);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "unknown --flow exits 1",
    async () => {
      const port = await getFreePort();
      const result = await runCli(
        [
          "audit",
          "--json",
          "--cwd",
          join(repoRoot, "examples/flows/html-dialog"),
          "--flow",
          "does-not-exist",
        ],
        { env: { PORT: String(port) } },
      );
      expect(result.code).toBe(1);
      const payload = JSON.parse(result.stdout) as { status: string };
      expect(payload.status).toBe("failed");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "unknown --profile exits 1",
    async () => {
      const port = await getFreePort();
      const result = await runCli(
        [
          "audit",
          "--json",
          "--cwd",
          join(repoRoot, "examples/flows/html-dialog"),
          "--flow",
          "dialog-accessible",
          "--profile",
          "large-text",
        ],
        { env: { PORT: String(port) } },
      );
      expect(result.code).toBe(1);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "--routes-only skips flow checkpoint runs",
    async () => {
      const port = await getFreePort();
      const result = await runCli(
        [
          "audit",
          "--json",
          "--cwd",
          join(repoRoot, "examples/flows/html-dialog"),
          "--routes-only",
        ],
        { env: { PORT: String(port) } },
      );
      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        runs: Array<{ kind?: string }>;
      };
      expect(payload.runs.every((run) => run.kind !== "flow-checkpoint")).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "missing valueFromEnv exits 1 for sensitive fill step",
    async () => {
      await withTempDir("a11yst-flow-secret-", async (dir) => {
        const port = await getFreePort();
        const config = `export default {
  projects: [{
    name: "secret-flow",
    platform: "web",
    framework: "html",
    baseUrl: "http://127.0.0.1:${port}",
    devServer: {
      command: "node ${JSON.stringify(join(repoRoot, "examples/flows/html-dialog/serve.mjs"))}",
      url: "http://127.0.0.1:${port}",
      reuseExisting: false,
    },
    routes: [{ path: "/accessible" }],
    profiles: ["default"],
    viewports: [{ name: "desktop", width: 1440, height: 900 }],
    flows: [{
      id: "needs-env",
      start: "/accessible",
      viewports: ["desktop"],
      steps: [
        { action: "fill", locator: { role: "textbox", name: "Name" }, valueFromEnv: "A11YST_TEST_SECRET", sensitive: true },
        { action: "checkpoint", id: "done" },
      ],
    }],
  }],
};`;
        await writeFile(join(dir, "a11yst.config.mjs"), config, "utf8");
        const result = await runCli(["audit", "--json", "--flow", "needs-env"], {
          cwd: dir,
          env: { PORT: String(port) },
        });
        expect(result.code).toBe(1);
        expect(result.stdout + result.stderr).not.toContain("A11YST_TEST_SECRET");
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "works with output directory containing spaces",
    async () => {
      const port = await getFreePort();
      const result = await withTempDir("a11yst flow spaces ", async (output) =>
        runCli(
          [
            "audit",
            "--cwd",
            join(repoRoot, "examples/flows/html-dialog"),
            "--flows-only",
            "--flow",
            "dialog-accessible",
            "--output",
            output,
            "--json",
          ],
          { env: { PORT: String(port) } },
        ),
      );
      expect(result.code).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    },
    TEST_TIMEOUT_MS,
  );
});
