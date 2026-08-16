import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BASELINE_EXAMPLES } from "../../helpers/baseline.js";
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

describe.sequential("CLI baseline integration (real Chromium + seeded fixtures)", () => {
  it(
    "audit --json applies baseline comparison from the seeded legacy-html fixture",
    async () => {
      const port = await getFreePort();
      const result = await auditLegacyExample(["--json"], { env: { PORT: String(port) } });

      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        baselineSummary?: { baselineUsed: boolean; newFindings: number; knownFindings: number };
      };
      expect(payload.baselineSummary?.baselineUsed).toBe(true);
      expect(payload.baselineSummary?.newFindings).toBe(1);
      expect(payload.baselineSummary?.knownFindings).toBe(3);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "audit --no-baseline omits baselineSummary from JSON output",
    async () => {
      const port = await getFreePort();
      const result = await auditLegacyExample(["--json", "--no-baseline"], {
        env: { PORT: String(port) },
      });

      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        baselineSummary?: unknown;
        findings: Array<{ baseline?: unknown }>;
      };
      expect(payload.baselineSummary).toBeUndefined();
      expect(payload.findings.every((finding) => finding.baseline === undefined)).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "baseline status --json reports comparison against latest audit results",
    async () => {
      const port = await getFreePort();
      await withTempDir("a11yst-baseline-status-", async (output) => {
        const audit = await auditLegacyExample(["--json", "--output", output], {
          env: { PORT: String(port) },
        });
        expect(audit.code).toBe(0);

        const status = await runCli(["baseline", "status", "--json"], { cwd: LEGACY_DIR });
        expect(status.code).toBe(0);
        const payload = JSON.parse(status.stdout) as {
          baseline: { entries: unknown[] };
          summary?: { baselineUsed: boolean; resolvedFindings: number };
        };
        expect(payload.baseline.entries.length).toBeGreaterThan(0);
        expect(payload.summary?.baselineUsed).toBe(true);
        expect(payload.summary?.resolvedFindings).toBe(1);
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "baseline create --force writes a baseline from explicit audit results in a temp workspace",
    async () => {
      const port = await getFreePort();
      await withTempDir("a11yst-baseline-create-", async (workspace) => {
        const output = join(workspace, "out");
        const audit = await auditLegacyExample(["--json", "--output", output], {
          env: { PORT: String(port) },
        });
        expect(audit.code).toBe(0);
        const auditPayload = JSON.parse(audit.stdout) as {
          artifacts?: { resultsPath?: string };
        };
        const resultsPath = resolveResultsPath(
          auditPayload.artifacts!.resultsPath!,
          output,
        );
        expect(resultsPath).toBeTruthy();

        await writeFile(join(workspace, "a11yst.config.mjs"), MINIMAL_BASELINE_CONFIG, "utf8");
        const create = await runCli(
          ["baseline", "create", "--force", "--json", "--from", resultsPath],
          { cwd: workspace },
        );
        expect(create.code).toBe(0);
        const payload = JSON.parse(create.stdout) as {
          status: string;
          entryCount: number;
        };
        expect(payload.status).toBe("created");
        expect(payload.entryCount).toBeGreaterThan(0);

        const baseline = JSON.parse(
          await readFile(join(workspace, ".a11yst/baseline.json"), "utf8"),
        ) as { entries: unknown[] };
        expect(baseline.entries.length).toBe(payload.entryCount);
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "baseline update --dry-run previews changes without writing the baseline file",
    async () => {
      const port = await getFreePort();
      await withTempDir("a11yst-baseline-update-", async (output) => {
        const audit = await auditLegacyExample(["--json", "--output", output], {
          env: { PORT: String(port) },
        });
        expect(audit.code).toBe(0);

        const before = await readFile(join(LEGACY_DIR, ".a11yst/baseline.json"), "utf8");
        const update = await runCli(
          ["baseline", "update", "--dry-run", "--accept-new", "--json"],
          { cwd: LEGACY_DIR },
        );
        expect(update.code).toBe(0);
        const payload = JSON.parse(update.stdout) as {
          status: string;
          preview: { hasChanges: boolean };
        };
        expect(payload.status).toBe("preview");
        expect(payload.preview.hasChanges).toBe(true);

        const after = await readFile(join(LEGACY_DIR, ".a11yst/baseline.json"), "utf8");
        expect(after).toBe(before);
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "baseline migrate --dry-run reports unchanged current-schema baseline",
    async () => {
      const result = await runCli(["baseline", "migrate", "--dry-run", "--json"], {
        cwd: LEGACY_DIR,
      });
      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        status: string;
        migrated: boolean;
      };
      expect(payload.status).toBe("unchanged");
      expect(payload.migrated).toBe(false);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "findings --json enriches lifecycle status from the baseline",
    async () => {
      const port = await getFreePort();
      await withTempDir("a11yst-baseline-findings-", async (output) => {
        const audit = await auditLegacyExample(["--json", "--output", output], {
          env: { PORT: String(port) },
        });
        expect(audit.code).toBe(0);

        const findings = await runCli(["findings", "--json", "--status", "new"], {
          cwd: LEGACY_DIR,
        });
        expect(findings.code).toBe(0);
        const payload = JSON.parse(findings.stdout) as {
          baselineUsed: boolean;
          entries: Array<{ lifecycleStatus: string; ruleId: string }>;
        };
        expect(payload.baselineUsed).toBe(true);
        expect(payload.entries.every((entry) => entry.lifecycleStatus === "new")).toBe(true);
        expect(payload.entries.some((entry) => entry.ruleId === "label")).toBe(true);
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "classify exits 2 for preview and --yes writes classification in a temp workspace",
    async () => {
      const port = await getFreePort();
      await withTempDir("a11yst-baseline-classify-", async (workspace) => {
        const output = join(workspace, "out");
        const audit = await auditLegacyExample(["--json", "--output", output], {
          env: { PORT: String(port) },
        });
        expect(audit.code).toBe(0);
        const auditPayload = JSON.parse(audit.stdout) as {
          findings: Array<{ id: string; route?: string; ruleId: string }>;
          artifacts?: { resultsPath?: string };
        };
        const target = auditPayload.findings.find(
          (finding) => finding.route === "/contact" && finding.ruleId === "label",
        );
        expect(target?.id).toBeTruthy();
        expect(auditPayload.artifacts?.resultsPath).toBeTruthy();
        const resultsPath = resolveResultsPath(
          auditPayload.artifacts!.resultsPath!,
          output,
        );

        await seedTempBaselineWorkspace(workspace);

        const preview = await runCli(
          [
            "classify",
            target!.id,
            "--disposition",
            "manual-review",
            "--reason",
            "Needs product confirmation",
            "--from",
            resultsPath,
            "--json",
          ],
          { cwd: workspace },
        );
        expect(preview.code).toBe(2);
        const previewPayload = JSON.parse(preview.stdout) as { status: string };
        expect(previewPayload.status).toBe("preview");

        const apply = await runCli(
          [
            "classify",
            target!.id,
            "--disposition",
            "manual-review",
            "--reason",
            "Needs product confirmation",
            "--from",
            resultsPath,
            "--yes",
            "--json",
          ],
          { cwd: workspace },
        );
        expect(apply.code).toBe(0);
        const applyPayload = JSON.parse(apply.stdout) as { status: string };
        expect(applyPayload.status).toBe("classified");

        const baseline = JSON.parse(
          await readFile(join(workspace, ".a11yst/baseline.json"), "utf8"),
        ) as {
          entries: Array<{ classification?: { disposition: string } }>;
        };
        expect(
          baseline.entries.some(
            (entry) => entry.classification?.disposition === "manual-review",
          ),
        ).toBe(true);
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "unclassify exits 2 for preview and --yes removes classification in a temp workspace",
    async () => {
      const port = await getFreePort();
      await withTempDir("a11yst-baseline-unclassify-", async (workspace) => {
        const output = join(workspace, "out");
        const audit = await auditLegacyExample(["--json", "--output", output], {
          env: { PORT: String(port) },
        });
        expect(audit.code).toBe(0);
        const auditPayload = JSON.parse(audit.stdout) as {
          findings: Array<{ id: string; baseline?: { classification?: { disposition: string } } }>;
          artifacts?: { resultsPath?: string };
        };
        const target = auditPayload.findings.find(
          (finding) => finding.baseline?.classification?.disposition === "false-positive",
        );
        expect(target?.id).toBeTruthy();
        expect(auditPayload.artifacts?.resultsPath).toBeTruthy();
        const resultsPath = resolveResultsPath(
          auditPayload.artifacts!.resultsPath!,
          output,
        );

        await seedTempBaselineWorkspace(workspace);

        const preview = await runCli(
          ["unclassify", target!.id, "--from", resultsPath, "--json"],
          { cwd: workspace },
        );
        expect(preview.code).toBe(2);

        const apply = await runCli(
          [
            "unclassify",
            target!.id,
            "--from",
            resultsPath,
            "--yes",
            "--json",
          ],
          { cwd: workspace },
        );
        expect(apply.code).toBe(0);
        const applyPayload = JSON.parse(apply.stdout) as { status: string };
        expect(applyPayload.status).toBe("removed");

        const baseline = JSON.parse(
          await readFile(join(workspace, ".a11yst/baseline.json"), "utf8"),
        ) as {
          entries: Array<{ fingerprint: string; classification?: unknown }>;
        };
        const iconAction = baseline.entries.find((entry) =>
          entry.fingerprint.includes("#icon-action"),
        );
        expect(iconAction?.classification).toBeUndefined();
      });
    },
    TEST_TIMEOUT_MS,
  );
});
