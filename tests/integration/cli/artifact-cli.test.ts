import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot, runCli, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const TEST_TIMEOUT_MS = 180_000;

async function filesBelow(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(root, entry.name);
        return entry.isDirectory() ? filesBelow(path) : [path];
      }),
    )
  ).flat();
}

async function runAuditExample(
  example: string,
  output: string,
  args: string[] = [],
  port?: number,
) {
  return runCli(["audit", ...args, "--output", output], {
    cwd: join(repoRoot, "examples", example),
    env: port ? { PORT: String(port) } : undefined,
  });
}

describe.sequential("CLI artifacts (real CLI + Chromium)", () => {
  it("writes the default bundle, pure JSON references, and supports an output path with spaces", async () => {
    await withTempDir("a11yst-cli-artifacts-", async (root) => {
      const output = join(root, "output directory with spaces");
      const result = await runAuditExample(
        "audit/html-inaccessible",
        output,
        ["--json"],
        await getFreePort(),
      );
      expect(result.code).toBe(0);
      expect(result.stderr).toBe("");
      const payload = JSON.parse(result.stdout) as {
        auditId: string;
        status: string;
        findings: Array<{ ruleId: string }>;
        artifacts: {
          outputDirectory: string;
          manifestPath: string;
          resultsPath: string;
          evidenceDirectory: string;
          latestPath: string;
          reportPath?: string;
        };
      };
      expect(payload.auditId).toBeTruthy();
      expect(payload.status).toBe("completed");
      expect(payload.findings.some((finding) => finding.ruleId === "button-name")).toBe(true);
      expect(payload.artifacts.reportPath).toBeUndefined();
      for (const path of [
        payload.artifacts.outputDirectory,
        payload.artifacts.manifestPath,
        payload.artifacts.resultsPath,
        payload.artifacts.evidenceDirectory,
        payload.artifacts.latestPath,
      ]) {
        await access(path);
      }
      const pngs = (await filesBelow(payload.artifacts.outputDirectory)).filter((path) =>
        path.endsWith(".png"),
      );
      expect(pngs.length).toBeGreaterThan(0);
      const png = await readFile(pngs[0]!);
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png.readUInt32BE(16)).toBeGreaterThan(0);
      expect(png.readUInt32BE(20)).toBeGreaterThan(0);
      const manifest = JSON.parse(await readFile(payload.artifacts.manifestPath, "utf8")) as {
        auditId: string;
        reportPath?: string;
        evidenceDirectory?: string;
      };
      expect(manifest.auditId).toBe(payload.auditId);
      expect(manifest.reportPath).toBeUndefined();
      expect(manifest.evidenceDirectory).toBe("evidence");
    });
  }, TEST_TIMEOUT_MS);

  it("honors --no-screenshots and --full-page-screenshots", async () => {
    await withTempDir("a11yst-cli-flags-", async (root) => {
      const noScreens = await runAuditExample(
        "audit/html-inaccessible",
        join(root, "no-screens"),
        ["--json", "--no-screenshots"],
        await getFreePort(),
      );
      expect(noScreens.code).toBe(0);
      const noScreensPayload = JSON.parse(noScreens.stdout) as {
        artifacts: { outputDirectory: string; evidenceDirectory?: string };
        runs: Array<{ evidence?: { screenshot?: string } }>;
      };
      expect(noScreensPayload.artifacts.evidenceDirectory).toBeUndefined();
      expect(noScreensPayload.runs.every((run) => run.evidence?.screenshot === undefined)).toBe(
        true,
      );
      expect(
        (await filesBelow(noScreensPayload.artifacts.outputDirectory)).some((path) =>
          path.endsWith(".png"),
        ),
      ).toBe(false);

      const fullPage = await runAuditExample(
        "audit/html-inaccessible",
        join(root, "full-page"),
        ["--json", "--full-page-screenshots"],
        await getFreePort(),
      );
      expect(fullPage.code).toBe(0);
      const fullPagePayload = JSON.parse(fullPage.stdout) as {
        artifacts: { outputDirectory: string };
        runs: Array<{ evidence?: { screenshot?: string } }>;
      };
      const screenshot = fullPagePayload.runs[0]?.evidence?.screenshot;
      expect(screenshot).toBeTruthy();
      await access(join(fullPagePayload.artifacts.outputDirectory, screenshot!));
    });
  }, TEST_TIMEOUT_MS);

  it("uses exit 0 for findings and exit 1 for server and artifact write failures", async () => {
    await withTempDir("a11yst-cli-exits-", async (root) => {
      const findings = await runAuditExample(
        "audit/html-inaccessible",
        join(root, "findings"),
        [],
        await getFreePort(),
      );
      expect(findings.code).toBe(0);
      expect(findings.stdout).toMatch(/automated barrier/i);

      const downPort = await getFreePort();
      await writeFile(
        join(root, "a11yst.config.mjs"),
        `export default {
        projects: [{
          name: "down", platform: "web", framework: "html",
          baseUrl: "http://127.0.0.1:${downPort}", routes: ["/"],
          profiles: ["default"], viewports: [{ name: "desktop", width: 800, height: 600 }]
        }]
      };`,
        "utf8",
      );
      const down = await runCli(
        ["audit", "--json", "--no-start-server", "--output", join(root, "down")],
        { cwd: root },
      );
      expect(down.code).toBe(1);
      expect(JSON.parse(down.stdout).status).toBe("failed");

      const outputFile = join(root, "not-a-directory");
      await writeFile(outputFile, "occupied", "utf8");
      const writeFailure = await runCli(["audit", "--json", "--output", outputFile], {
        cwd: root,
      });
      expect(writeFailure.code).toBe(1);
      expect(JSON.parse(writeFailure.stdout).status).toBe("error");
    });
  }, TEST_TIMEOUT_MS);
});
