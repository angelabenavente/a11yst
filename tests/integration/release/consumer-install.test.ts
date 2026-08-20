import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getFreePort } from "../../helpers/net.js";
import {
  CONSUMER_SECRET,
  CONSUMER_SOURCE_MARKER,
  assertInstalledPackagesIndependent,
  createConsumerScenarioRoot,
  frozenReinstallConsumerProjectWithFallback,
  installConsumerProjectWithFallback,
  consumerBinExists,
  packPublishableClosure,
  readConsumerLockfile,
  readLatestConsumerResults,
  removeConsumerScenarioRoot,
  runInstalledA11yst,
  runInstalledBin,
  runPnpm,
  scanTextForSensitiveValues,
  summarizeCommandFailure,
  validateConsumerProjectManifest,
  writeConsumerProject,
} from "../../helpers/release/consumer-install.js";
import { getRepoRoot } from "../../helpers/release/workspace-packages.js";

const TEST_TIMEOUT_MS = 900_000;

type FindingRecord = {
  ruleId?: string;
  route?: string;
  sourceMapping?: {
    status?: string;
    selected?: { location?: { uri?: string } };
  };
  recommendations?: {
    status?: string;
    recommendations?: Array<{
      actions?: unknown[];
      verification?: unknown[];
    }>;
  };
};

describe.sequential("release consumer install", () => {
  it(
    "installs real tarballs in an external consumer project and runs the installed CLI end-to-end",
    async () => {
      const repoRoot = getRepoRoot();
      const scenarioRoot = await createConsumerScenarioRoot();
      const packsDir = join(scenarioRoot, "packs");
      const consumerDir = join(scenarioRoot, "consumer");
      let lockfileBefore = "";
      let auditPort = 0;

      try {
        const [nodeMajor = 0, nodeMinor = 0] = process.versions.node.split(".").map(Number);
        expect(
          nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 12),
          "consumer install validation requires Node 22.12+",
        ).toBe(true);

        const { tarballByPackage, publishableClosure } = await packPublishableClosure(packsDir);
        expect(tarballByPackage.size).toBe(27);
        expect(publishableClosure).toHaveLength(27);

        const manifest = await writeConsumerProject({
          consumerDir,
          tarballByPackage,
          publishableClosure,
        });
        expect(validateConsumerProjectManifest(manifest)).toEqual([]);
        expect(manifest.pnpm.overrides["@a11yst/cli"]).toContain("a11yst-cli-1.0.0.tgz");
        expect(manifest.pnpm.overrides["@a11yst/adapters"]).toContain("a11yst-adapters-1.0.0.tgz");

        const install = await installConsumerProjectWithFallback(consumerDir);
        if (install.result.code !== 0 || !(await consumerBinExists(consumerDir))) {
          throw new Error(
            summarizeCommandFailure("consumer install", install.result) +
              `\nofflineSucceeded: ${install.offlineSucceeded}`,
          );
        }

        lockfileBefore = await readConsumerLockfile(consumerDir);
        expect(lockfileBefore.includes("workspace:")).toBe(false);
        expect(lockfileBefore.includes(repoRoot)).toBe(false);

        await assertInstalledPackagesIndependent({
          consumerDir,
          expectedClosure: publishableClosure,
          repoRoot,
        });

        const rootLicense = await readFile(join(repoRoot, "LICENSE"), "utf8");
        const rootLicenseHash = createHash("sha256").update(rootLicense).digest("hex");
        const installedCliManifest = JSON.parse(
          await readFile(join(consumerDir, "node_modules", "@a11yst", "cli", "package.json"), "utf8"),
        ) as { license?: string };
        expect(installedCliManifest.license).toBe("MPL-2.0");
        const installedCliLicense = await readFile(
          join(consumerDir, "node_modules", "@a11yst", "cli", "LICENSE"),
          "utf8",
        );
        expect(createHash("sha256").update(installedCliLicense).digest("hex")).toBe(rootLicenseHash);

        const help = runInstalledA11yst(consumerDir, ["--help"]);
        expect(help.code, summarizeCommandFailure("a11yst --help", help)).toBe(0);
        expect(help.stdout).toContain("a11yst");
        expect(help.stdout).toMatch(/\baudit\b/);
        expect(help.stderr).not.toMatch(/\n\s+at\s+/);

        const directBin = runInstalledBin(consumerDir, ["--help"]);
        expect(directBin.code).toBe(0);

        for (const args of [
          ["detect", "--help"],
          ["routes", "--help"],
          ["profiles", "--help"],
          ["flows", "--help"],
          ["audit", "--help"],
          ["report", "--help"],
        ] as const) {
          const result = runInstalledA11yst(consumerDir, [...args]);
          expect(result.code, summarizeCommandFailure(`a11yst ${args.join(" ")}`, result)).toBe(0);
        }

        const detect = runInstalledA11yst(consumerDir, ["detect", "--cwd", "."]);
        expect(detect.code, summarizeCommandFailure("a11yst detect", detect)).toBe(0);
        expect(`${detect.stdout}${detect.stderr}`.toLowerCase()).toContain("html");
        expect(`${detect.stdout}${detect.stderr}`).not.toContain(repoRoot);

        const playwrightVersion = runPnpm(["exec", "playwright", "--version"], consumerDir);
        expect(
          playwrightVersion.code,
          summarizeCommandFailure("pnpm exec playwright --version", playwrightVersion),
        ).toBe(0);

        const emptyBrowsersPath = join(scenarioRoot, "empty-browsers");
        await mkdir(emptyBrowsersPath, { recursive: true });
        auditPort = await getFreePort();
        const missingBrowserAudit = runInstalledA11yst(
          consumerDir,
          ["audit", "--json", "--cwd", "."],
          {
            PORT: String(auditPort),
            PLAYWRIGHT_BROWSERS_PATH: emptyBrowsersPath,
          },
          { timeoutMs: 120_000 },
        );
        expect(missingBrowserAudit.code).not.toBe(0);
        expect(missingBrowserAudit.code).not.toBe(2);
        expect(`${missingBrowserAudit.stderr}${missingBrowserAudit.stdout}`.toLowerCase()).toMatch(
          /browser|chromium|playwright|executable/,
        );

        auditPort = await getFreePort();
        const audit = runInstalledA11yst(
          consumerDir,
          ["audit", "--json", "--cwd", "."],
          {
            PORT: String(auditPort),
          },
          { timeoutMs: 600_000 },
        );
        expect(audit.code, summarizeCommandFailure("a11yst audit", audit)).toBe(0);

        const auditPayload = JSON.parse(audit.stdout) as { findings?: FindingRecord[] };
        expect(Array.isArray(auditPayload.findings)).toBe(true);
        expect(auditPayload.findings!.length).toBeGreaterThanOrEqual(1);

        const { runDir, resultsPath, results } = await readLatestConsumerResults(consumerDir);
        const findings = (results.findings ?? []) as FindingRecord[];
        expect(findings.length).toBeGreaterThanOrEqual(1);
        expect(findings.some((finding) => finding.route === "/")).toBe(true);

        const mappedFinding = findings.find(
          (finding) =>
            finding.sourceMapping?.status === "mapped" &&
            finding.sourceMapping.selected?.location?.uri?.includes("site/index.html"),
        );
        expect(mappedFinding).toBeDefined();
        expect(mappedFinding?.sourceMapping?.selected?.location?.uri).not.toContain(repoRoot);

        const recommendedFinding = findings.find(
          (finding) =>
            finding.recommendations?.status === "recommended" ||
            finding.recommendations?.status === "manual-review",
        );
        expect(recommendedFinding).toBeDefined();
        expect(recommendedFinding?.recommendations?.recommendations?.[0]?.actions?.length).toBeGreaterThan(
          0,
        );
        expect(recommendedFinding?.recommendations?.recommendations?.[0]?.verification?.length).toBeGreaterThan(
          0,
        );

        const artifacts = results.artifacts as { reportPath?: string; markdownPath?: string } | undefined;
        const htmlPath = join(runDir, artifacts?.reportPath ?? "report/index.html");
        const html = await readFile(htmlPath, "utf8");
        expect(html.length).toBeGreaterThan(0);
        expect(html).toContain("do not establish");
        expect(html).not.toContain("Findings (axe)");
        expect(html).not.toContain("Findings (a11yst)");
        expect(html).not.toContain("axe impact");
        expect(html).not.toContain("axe-core in Chromium");
        expect(scanTextForSensitiveValues(html, { repoRoot, secret: CONSUMER_SECRET, sourceMarker: CONSUMER_SOURCE_MARKER })).toEqual([]);

        expect(artifacts?.markdownPath).toBe("reports/a11yst.md");
        const markdownPath = join(runDir, artifacts?.markdownPath ?? "reports/a11yst.md");
        const markdown = await readFile(markdownPath, "utf8");
        expect(markdown.length).toBeGreaterThan(0);
        expect(markdown).toContain("a11yst Accessibility Report");
        expect(markdown).toContain("## Findings");
        expect(markdown).not.toContain("Findings (axe)");
        expect(markdown).not.toContain("Findings (a11yst)");
        expect(markdown).not.toContain("axe impact");
        expect(markdown).not.toContain("axe-core in Chromium");
        // eslint-disable-next-line no-control-regex
        expect(markdown).not.toMatch(/\x1b\[[0-9;]*m/);
        expect(
          scanTextForSensitiveValues(markdown, {
            repoRoot,
            secret: CONSUMER_SECRET,
            sourceMarker: CONSUMER_SOURCE_MARKER,
          }),
        ).toEqual([]);

        const serializedResults = JSON.stringify(results);
        expect(
          scanTextForSensitiveValues(serializedResults, {
            repoRoot,
            tempRoot: scenarioRoot,
            secret: CONSUMER_SECRET,
            sourceMarker: CONSUMER_SOURCE_MARKER,
          }),
        ).toEqual([]);

        const relativeResultsPath = resultsPath.slice(consumerDir.length + 1);
        const report = runInstalledA11yst(
          consumerDir,
          ["report", relativeResultsPath, "--format", "markdown", "--output", ".a11yst/regenerated"],
        );
        expect(report.code, summarizeCommandFailure("a11yst report", report)).toBe(0);
        const regeneratedMarkdown = await readFile(join(consumerDir, ".a11yst/regenerated"), "utf8");
        expect(regeneratedMarkdown.length).toBeGreaterThan(0);
        expect(
          scanTextForSensitiveValues(regeneratedMarkdown, {
            repoRoot,
            secret: CONSUMER_SECRET,
            sourceMarker: CONSUMER_SOURCE_MARKER,
          }),
        ).toEqual([]);

        await rm(join(consumerDir, "node_modules"), { recursive: true, force: true });
        const frozen = await frozenReinstallConsumerProjectWithFallback(consumerDir);
        expect(frozen.code, summarizeCommandFailure("frozen reinstall", frozen)).toBe(0);
        expect(await readConsumerLockfile(consumerDir)).toBe(lockfileBefore);

        const helpAfterReinstall = runInstalledA11yst(consumerDir, ["--help"]);
        expect(helpAfterReinstall.code).toBe(0);

        const processScan = spawnSync(
          "ps",
          ["-eo", "pid,ppid,command"],
          { encoding: "utf8", shell: false },
        );
        const processLines = `${processScan.stdout}\n${processScan.stderr}`
          .split("\n")
          .filter((line) => line.includes(scenarioRoot))
          .filter((line) =>
            /node_modules\/\.bin\/a11yst|consumer fixture listening/.test(line),
          )
          .filter((line) => !line.includes(" rg "));
        expect(processLines).toEqual([]);

        const listener = spawnSync(
          "lsof",
          ["-nP", `-iTCP:${auditPort}`, "-sTCP:LISTEN"],
          { encoding: "utf8", shell: false },
        );
        expect(`${listener.stdout}${listener.stderr}`.trim()).toBe("");
      } finally {
        await removeConsumerScenarioRoot(scenarioRoot);
      }
    },
    TEST_TIMEOUT_MS,
  );
});
