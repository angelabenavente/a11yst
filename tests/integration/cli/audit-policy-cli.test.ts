import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BASELINE_EXAMPLES, copyBaselineExample } from "../../helpers/baseline.js";
import { repoRoot, runCli, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const LEGACY = BASELINE_EXAMPLES.legacyHtml;
const LEGACY_DIR = join(repoRoot, LEGACY);
const REACT = BASELINE_EXAMPLES.reactRegression;
const REACT_DIR = join(repoRoot, REACT);
const EXPIRY = BASELINE_EXAMPLES.classificationExpiry;
const EXPIRY_DIR = join(repoRoot, EXPIRY);
const TEST_TIMEOUT_MS = 240_000;
const REACT_AUDIT_TIMEOUT_MS = 180_000;

async function writeMinimalConfig(workspace: string, port: number, ciBlock = ""): Promise<void> {
  const source = `export default {
${ciBlock}  baseline: {
    file: ".a11yst/baseline.json",
    compare: true,
    classifications: true,
  },
  projects: [
    {
      name: "baseline-legacy-html",
      platform: "web",
      framework: "html",
      rootDir: ".",
      baseUrl: "http://127.0.0.1:${port}",
      devServer: {
        command: "node serve.mjs",
        url: "http://127.0.0.1:${port}",
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
  await writeFile(join(workspace, "a11yst.config.mjs"), source, "utf8");
}

async function seedLegacyWorkspace(workspace: string, options: { withBaseline?: boolean } = {}) {
  await copyBaselineExample(LEGACY, workspace);
  await rm(join(workspace, "a11yst.config.ts"), { force: true });
  if (options.withBaseline === false) {
    await rm(join(workspace, ".a11yst/baseline.json"), { force: true });
  }
}

async function auditLegacy(args: string[], env?: NodeJS.ProcessEnv) {
  const port = await getFreePort();
  return runCli(["audit", ...args, "--no-html"], {
    cwd: LEGACY_DIR,
    env: { PORT: String(port), ...env },
  });
}

async function auditReact(
  args: string[],
  options: { port: number; env?: NodeJS.ProcessEnv },
) {
  return runCli(["audit", ...args, "--no-html", "--no-start-server"], {
    cwd: REACT_DIR,
    env: { PORT: String(options.port), ...options.env },
  });
}

async function auditExpiry(args: string[], env?: NodeJS.ProcessEnv) {
  const port = await getFreePort();
  return runCli(["audit", ...args, "--no-html"], {
    cwd: EXPIRY_DIR,
    env: { PORT: String(port), ...env },
  });
}

describe.sequential("CLI audit CI policy integration", () => {
  it(
    "default audit with findings exits 0 and includes disabled policy evaluation",
    async () => {
      const result = await auditLegacy(["--json"]);
      expect(result.code).toBe(0);

      const payload = JSON.parse(result.stdout) as {
        policyEvaluation?: { policyEnabled: boolean; status: string };
        baselineSummary?: { baselineUsed: boolean; newFindings: number };
      };
      expect(payload.baselineSummary?.baselineUsed).toBe(true);
      expect(payload.baselineSummary?.newFindings).toBeGreaterThan(0);
      expect(payload.policyEvaluation?.policyEnabled).toBe(false);
      expect(payload.policyEvaluation?.status).toBe("passed");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "fail-on-new exits 2 with structured breach for new serious finding",
    async () => {
      const result = await auditLegacy([
        "--json",
        "--fail-on-new",
        "--minimum-severity",
        "high",
      ]);
      expect(result.code).toBe(2);

      const payload = JSON.parse(result.stdout) as {
        policyEvaluation: {
          status: string;
          breaches: Array<{ kind: string; lifecycleStatus: string }>;
        };
      };
      expect(payload.policyEvaluation.status).toBe("failed");
      expect(payload.policyEvaluation.breaches.some((b) => b.kind === "new-finding")).toBe(
        true,
      );
      expect(result.stdout.trim().startsWith("{")).toBe(true);
      expect(result.stderr).not.toContain("{");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "fail-on-regression exits 2 for severity regression in react-regression fixture",
    async () => {
      const port = await getFreePort();
      const { startReactRegressionServer } = await import("../../helpers/baseline.js");
      const { stop } = await startReactRegressionServer(port);
      try {
        const result = await auditReact(["--json", "--fail-on-regression"], { port });
        expect(result.code).toBe(2);
        const payload = JSON.parse(result.stdout) as {
          policyEvaluation: {
            breaches: Array<{ kind: string; reason?: string }>;
          };
        };
        expect(
          payload.policyEvaluation.breaches.some(
            (breach) =>
              breach.kind === "regressed-finding" && breach.reason === "severity-increased",
          ),
        ).toBe(true);
      } finally {
        await stop();
      }
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "fail-on-expired-classification exits 2 with a single expired breach",
    async () => {
      const result = await auditExpiry([
        "--json",
        "--fail-on-expired-classification",
        "--minimum-severity",
        "medium",
      ]);
      expect(result.code).toBe(2);
      const payload = JSON.parse(result.stdout) as {
        policyEvaluation: {
          summary: {
            expiredClassificationBreaches: number;
            regressionBreaches: number;
            totalBreaches: number;
          };
          breaches: Array<{ kind: string }>;
        };
      };
      expect(payload.policyEvaluation.summary.expiredClassificationBreaches).toBe(1);
      expect(payload.policyEvaluation.summary.totalBreaches).toBe(1);
      expect(
        payload.policyEvaluation.breaches.every(
          (breach) => breach.kind === "expired-classification",
        ),
      ).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "CLI overrides disable config-enabled policy gates",
    async () => {
      await withTempDir("a11yst-policy-override-", async (workspace) => {
        await seedLegacyWorkspace(workspace);
        const port = await getFreePort();
        await writeMinimalConfig(
          workspace,
          port,
          `  ci: {
    failOnNew: true,
    failOnRegression: true,
    minimumSeverity: "high",
  },
`,
        );

        const result = await runCli(
          [
            "audit",
            "--json",
            "--no-fail-on-new",
            "--no-fail-on-regression",
            "--no-html",
          ],
          {
            cwd: workspace,
            env: { PORT: String(port) },
          },
        );

        expect(result.code).toBe(0);
        const payload = JSON.parse(result.stdout) as {
          policyEvaluation: { policyEnabled: boolean; status: string };
        };
        expect(payload.policyEvaluation.policyEnabled).toBe(false);
        expect(payload.policyEvaluation.status).toBe("passed");
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "enabled policy without baseline exits 1 as not-evaluated",
    async () => {
      await withTempDir("a11yst-policy-no-baseline-", async (workspace) => {
        await seedLegacyWorkspace(workspace, { withBaseline: false });
        const port = await getFreePort();
        await writeMinimalConfig(workspace, port);
        const result = await runCli(
          ["audit", "--json", "--fail-on-new", "--no-html"],
          {
            cwd: workspace,
            env: { PORT: String(port) },
          },
        );

        expect(result.code).toBe(1);
        const payload = JSON.parse(result.stdout) as {
          policyEvaluation: {
            status: string;
            breaches: unknown[];
            baselineUsed: boolean;
          };
          findings: Array<{ baseline?: { status: string } }>;
        };
        expect(payload.policyEvaluation.status).toBe("not-evaluated");
        expect(payload.policyEvaluation.breaches).toHaveLength(0);
        expect(payload.policyEvaluation.baselineUsed).toBe(false);
        expect(payload.findings.every((finding) => finding.baseline === undefined)).toBe(true);
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "no-baseline with enabled policy exits 1, not 2",
    async () => {
      const result = await auditLegacy(["--json", "--fail-on-new", "--no-baseline"]);
      expect(result.code).toBe(1);
      const payload = JSON.parse(result.stdout) as {
        policyEvaluation: { status: string; breaches: unknown[] };
      };
      expect(payload.policyEvaluation.status).toBe("not-evaluated");
      expect(payload.policyEvaluation.breaches).toHaveLength(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "missing explicit baseline with fail-on-new exits 1 operationally",
    async () => {
      const result = await auditLegacy([
        "--json",
        "--fail-on-new",
        "--baseline",
        "./missing-baseline.json",
      ]);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('"status": "error"');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "minimum severity high blocks severity regression",
    async () => {
      const port = await getFreePort();
      const { startReactRegressionServer } = await import("../../helpers/baseline.js");
      const { stop } = await startReactRegressionServer(port);
      try {
        const blocked = await auditReact(
          ["--json", "--fail-on-regression", "--minimum-severity", "high"],
          { port },
        );
        expect(blocked.code).toBe(2);
        const payload = JSON.parse(blocked.stdout) as {
          policyEvaluation: { breaches: Array<{ kind: string; severity: string }> };
        };
        expect(
          payload.policyEvaluation.breaches.some((breach) => breach.kind === "regressed-finding"),
        ).toBe(true);
      } finally {
        await stop();
      }
    },
    REACT_AUDIT_TIMEOUT_MS,
  );

  it(
    "create-baseline with enabled policy and no prior baseline exits 1 as not-evaluated",
    async () => {
      await withTempDir("a11yst-policy-create-baseline-", async (workspace) => {
        await seedLegacyWorkspace(workspace, { withBaseline: false });
        const port = await getFreePort();
        await writeMinimalConfig(workspace, port);
        const result = await runCli(
          ["audit", "--json", "--fail-on-new", "--create-baseline", "--force", "--no-html"],
          {
            cwd: workspace,
            env: { PORT: String(port) },
          },
        );

        expect(result.code).toBe(1);
        const payload = JSON.parse(result.stdout) as {
          policyEvaluation: { status: string };
        };
        expect(payload.policyEvaluation.status).toBe("not-evaluated");
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "human output includes CI policy section when policy fails",
    async () => {
      const result = await auditLegacy(["--fail-on-new", "--minimum-severity", "high"]);
      expect(result.code).toBe(2);
      expect(result.stdout).toContain("CI policy");
      expect(result.stdout).toContain("FAILED");
      expect(result.stdout.includes("\u001B")).toBe(false);
    },
    TEST_TIMEOUT_MS,
  );
});
