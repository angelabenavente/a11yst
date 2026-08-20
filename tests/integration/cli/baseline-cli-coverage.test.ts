import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BASELINE_EXAMPLES, copyBaselineExample } from "../../helpers/baseline.js";
import { repoRoot, runCli, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const LEGACY = BASELINE_EXAMPLES.legacyHtml;
const LEGACY_DIR = join(repoRoot, LEGACY);
const TEST_TIMEOUT_MS = 180_000;

const MINIMAL_BASELINE_CONFIG = `export default {
  baseline: {
    file: ".a11yst/baseline.json",
    compare: true,
    classifications: true,
  },
  projects: [
    {
      name: "baseline-legacy-html",
      platform: "web",
      framework: "html",
      routes: [{ id: "home", name: "Home", path: "/" }],
      baseUrl: "http://127.0.0.1:1",
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
};
`;

function legacyWorkspaceConfig(): string {
  return `const PORT = process.env.PORT ?? 6401;

export default {
  baseline: {
    file: ".a11yst/baseline.json",
    compare: true,
    classifications: true,
  },
  projects: [
    {
      name: "baseline-legacy-html",
      rootDir: ".",
      platform: "web",
      framework: "html",
      baseUrl: \`http://127.0.0.1:\${PORT}\`,
      devServer: {
        command: "node serve.mjs",
        url: \`http://127.0.0.1:\${PORT}\`,
        reuseExisting: true,
        startupTimeout: 30_000,
      },
      routes: [
        { id: "home", name: "Home", path: "/" },
        { id: "contact", name: "Contact", path: "/contact" },
        { id: "fixed", name: "Fixed", path: "/fixed" },
        { id: "review", name: "Review", path: "/review" },
      ],
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
};
`;
}

async function seedLegacyHtmlWorkspace(
  workspace: string,
  options: { includeBaseline?: boolean } = {},
): Promise<void> {
  await copyBaselineExample(LEGACY, workspace);
  await rm(join(workspace, "a11yst.config.ts"), { force: true });
  await writeFile(join(workspace, "a11yst.config.mjs"), legacyWorkspaceConfig(), "utf8");
  if (options.includeBaseline === false) {
    await rm(join(workspace, ".a11yst/baseline.json"));
  }
}

function resolveResultsPath(resultsPath: string, outputRoot?: string): string {
  if (resultsPath.startsWith("/")) {
    return resultsPath;
  }
  if (outputRoot) {
    return join(outputRoot, resultsPath);
  }
  return join(LEGACY_DIR, resultsPath);
}

async function auditLegacyExample(
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; output?: string } = {},
) {
  const outputArgs = options.output ? ["--output", options.output] : [];
  return runCli(["audit", ...args, ...outputArgs, "--no-html"], {
    cwd: options.cwd ?? LEGACY_DIR,
    env: options.env,
  });
}

async function seedTempBaselineWorkspace(workspace: string): Promise<void> {
  await mkdir(join(workspace, ".a11yst"), { recursive: true });
  await cp(join(LEGACY_DIR, ".a11yst/baseline.json"), join(workspace, ".a11yst/baseline.json"));
  await writeFile(join(workspace, "a11yst.config.mjs"), MINIMAL_BASELINE_CONFIG, "utf8");
}

describe.sequential("CLI baseline coverage (8c)", () => {
  it(
    "audit human output includes baseline summary without ANSI escapes when NO_COLOR is set",
    async () => {
      const port = await getFreePort();
      const result = await auditLegacyExample([], {
        env: { PORT: String(port), NO_COLOR: "1" },
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Baseline comparison");
      expect(result.stdout).toContain("A baseline records known accessibility debt.");
      // eslint-disable-next-line no-control-regex
      expect(result.stdout).not.toMatch(/\x1b\[[0-9;]*m/);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "audit --create-baseline writes a baseline file in a temp workspace",
    async () => {
      const port = await getFreePort();
      await withTempDir("a11yst-baseline-create-audit-", async (workspace) => {
        await seedLegacyHtmlWorkspace(workspace, { includeBaseline: false });

        const audit = await auditLegacyExample(["--create-baseline", "--json"], {
          cwd: workspace,
          env: { PORT: String(port) },
        });
        expect(audit.code).toBe(0);

        const payload = JSON.parse(audit.stdout) as {
          baselineSummary?: { baselineUsed: boolean };
          findings: unknown[];
        };
        expect(payload.baselineSummary).toBeUndefined();
        expect(payload.findings.length).toBeGreaterThan(0);

        const baseline = JSON.parse(
          await readFile(join(workspace, ".a11yst/baseline.json"), "utf8"),
        ) as { entries: unknown[] };
        expect(baseline.entries.length).toBeGreaterThan(0);
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "audit --baseline compares against an explicit baseline path",
    async () => {
      const port = await getFreePort();
      await withTempDir("a11yst-baseline-custom-path-", async (workspace) => {
        await seedLegacyHtmlWorkspace(workspace);
        const customPath = join(workspace, "custom baseline.json");
        await cp(join(workspace, ".a11yst/baseline.json"), customPath);

        const audit = await auditLegacyExample(["--json", "--baseline", customPath], {
          cwd: workspace,
          env: { PORT: String(port) },
        });
        expect(audit.code).toBe(0);
        const payload = JSON.parse(audit.stdout) as {
          baselineSummary?: { baselineUsed: boolean; baselinePath?: string };
        };
        expect(payload.baselineSummary?.baselineUsed).toBe(true);
        expect(payload.baselineSummary?.baselinePath).toContain("custom baseline.json");
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "baseline create rejects existing baseline without --force",
    async () => {
      await withTempDir("a11yst-baseline-create-exists-", async (workspace) => {
        await seedTempBaselineWorkspace(workspace);
        const result = await runCli(["baseline", "create", "--json"], { cwd: workspace });
        expect(result.code).toBe(1);
        expect(result.stderr).toContain("already exists");
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "baseline update exits 2 without --yes when changes would be written",
    async () => {
      const port = await getFreePort();
      await withTempDir("a11yst-baseline-update-confirm-", async (output) => {
        const audit = await auditLegacyExample(["--json", "--output", output], {
          env: { PORT: String(port) },
        });
        expect(audit.code).toBe(0);

        const update = await runCli(
          ["baseline", "update", "--accept-new", "--json"],
          { cwd: LEGACY_DIR },
        );
        expect(update.code).toBe(2);
        expect(update.stderr).toContain("requires confirmation");
        const payload = JSON.parse(update.stdout) as { status: string };
        expect(payload.status).toBe("preview");
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "baseline update --accept-new --yes applies changes in a temp workspace",
    async () => {
      const port = await getFreePort();
      await withTempDir("a11yst-baseline-update-apply-", async (workspace) => {
        await seedLegacyHtmlWorkspace(workspace);
        const output = join(workspace, "out");
        const audit = await auditLegacyExample(["--json", "--output", output], {
          cwd: workspace,
          env: { PORT: String(port) },
        });
        expect(audit.code).toBe(0);
        const auditPayload = JSON.parse(audit.stdout) as {
          artifacts?: { resultsPath?: string };
        };
        const resultsPath = resolveResultsPath(auditPayload.artifacts!.resultsPath!, output);

        const beforeCount = (
          JSON.parse(await readFile(join(workspace, ".a11yst/baseline.json"), "utf8")) as {
            entries: unknown[];
          }
        ).entries.length;

        const update = await runCli(
          [
            "baseline",
            "update",
            "--accept-new",
            "--yes",
            "--json",
            "--from",
            resultsPath,
          ],
          { cwd: workspace },
        );
        expect(update.code).toBe(0);
        const payload = JSON.parse(update.stdout) as { status: string };
        expect(payload.status).toBe("updated");

        const afterCount = (
          JSON.parse(await readFile(join(workspace, ".a11yst/baseline.json"), "utf8")) as {
            entries: unknown[];
          }
        ).entries.length;
        expect(afterCount).toBeGreaterThan(beforeCount);
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "baseline status exits 1 for corrupt and unsupported baseline files",
    async () => {
      await withTempDir("a11yst-baseline-invalid-", async (workspace) => {
        await seedTempBaselineWorkspace(workspace);

        await writeFile(join(workspace, ".a11yst/baseline.json"), "{not-json", "utf8");
        const corrupt = await runCli(["baseline", "status", "--json"], { cwd: workspace });
        expect(corrupt.code).toBe(1);

        await writeFile(
          join(workspace, ".a11yst/baseline.json"),
          JSON.stringify({
            schemaVersion: "99",
            fingerprintVersion: "1",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            productVersion: "1.0.0",
            entries: [],
          }),
          "utf8",
        );
        const future = await runCli(["baseline", "status", "--json"], { cwd: workspace });
        expect(future.code).toBe(1);
        expect(future.stderr).toContain("Unsupported baseline schemaVersion");
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "findings filters by lifecycle status and disposition",
    async () => {
      const port = await getFreePort();
      await withTempDir("a11yst-baseline-findings-filters-", async (output) => {
        const audit = await auditLegacyExample(["--json", "--output", output], {
          env: { PORT: String(port) },
        });
        expect(audit.code).toBe(0);

        const known = await runCli(["findings", "--json", "--status", "known"], {
          cwd: LEGACY_DIR,
        });
        expect(known.code).toBe(0);
        const knownPayload = JSON.parse(known.stdout) as {
          entries: Array<{ lifecycleStatus: string }>;
        };
        expect(knownPayload.entries.length).toBeGreaterThan(0);
        expect(knownPayload.entries.every((entry) => entry.lifecycleStatus === "known")).toBe(true);

        const resolved = await runCli(["findings", "--json", "--status", "resolved"], {
          cwd: LEGACY_DIR,
        });
        expect(resolved.code).toBe(0);
        const resolvedPayload = JSON.parse(resolved.stdout) as {
          entries: Array<{ lifecycleStatus: string; ruleId: string }>;
        };
        expect(resolvedPayload.entries.some((entry) => entry.lifecycleStatus === "resolved")).toBe(
          true,
        );

        const falsePositive = await runCli(
          ["findings", "--json", "--disposition", "false-positive"],
          { cwd: LEGACY_DIR },
        );
        expect(falsePositive.code).toBe(0);
        const dispositionPayload = JSON.parse(falsePositive.stdout) as {
          entries: Array<{ disposition?: string }>;
        };
        expect(
          dispositionPayload.entries.every(
            (entry) => entry.disposition === "false-positive",
          ),
        ).toBe(true);
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "read-only baseline commands succeed from saved results without a running dev server",
    async () => {
      const port = await getFreePort();
      await withTempDir("a11yst-baseline-readonly-", async (output) => {
        const audit = await auditLegacyExample(["--json", "--output", output], {
          env: { PORT: String(port) },
        });
        expect(audit.code).toBe(0);
        const auditPayload = JSON.parse(audit.stdout) as {
          artifacts?: { resultsPath?: string };
        };
        const resultsPath = resolveResultsPath(auditPayload.artifacts!.resultsPath!, output);

        const findings = await runCli(["findings", "--json", "--from", resultsPath], {
          cwd: LEGACY_DIR,
          env: { PORT: "1" },
        });
        expect(findings.code).toBe(0);

        const status = await runCli(["baseline", "status", "--json"], {
          cwd: LEGACY_DIR,
          env: { PORT: "1" },
        });
        expect(status.code).toBe(0);
        const statusPayload = JSON.parse(status.stdout) as { summary?: { baselineUsed: boolean } };
        expect(statusPayload.summary?.baselineUsed).toBe(true);
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "classify rejects resolved disposition, missing owner, and unknown finding ids",
    async () => {
      const port = await getFreePort();
      await withTempDir("a11yst-baseline-classify-errors-", async (workspace) => {
        const output = join(workspace, "out");
        const audit = await auditLegacyExample(["--json", "--output", output], {
          env: { PORT: String(port) },
        });
        expect(audit.code).toBe(0);
        const auditPayload = JSON.parse(audit.stdout) as {
          findings: Array<{ id: string }>;
          artifacts?: { resultsPath?: string };
        };
        const resultsPath = resolveResultsPath(auditPayload.artifacts!.resultsPath!, output);
        const targetId = auditPayload.findings[0]!.id;

        await seedTempBaselineWorkspace(workspace);

        const resolved = await runCli(
          [
            "classify",
            targetId,
            "--disposition",
            "resolved",
            "--reason",
            "Should fail",
            "--from",
            resultsPath,
            "--json",
          ],
          { cwd: workspace },
        );
        expect(resolved.code).toBe(1);
        expect(resolved.stderr).toContain('Invalid disposition "resolved"');

        const missingOwner = await runCli(
          [
            "classify",
            targetId,
            "--disposition",
            "accepted-risk",
            "--reason",
            "Needs owner",
            "--expires",
            "2099-12-31",
            "--from",
            resultsPath,
            "--json",
          ],
          { cwd: workspace },
        );
        expect(missingOwner.code).toBe(1);
        expect(missingOwner.stderr).toContain("require an owner");

        const unknown = await runCli(
          ["classify", "does-not-exist", "--disposition", "manual-review", "--reason", "Nope", "--from", resultsPath],
          { cwd: workspace },
        );
        expect(unknown.code).toBe(1);
        expect(unknown.stderr).toContain("No finding matches identifier");
      });
    },
    TEST_TIMEOUT_MS,
  );
});
