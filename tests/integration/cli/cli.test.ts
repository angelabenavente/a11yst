import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli, withTempDir, writeConfig } from "../../helpers/cli.js";

const LEGACY_IDENTITY = ["Allyst", "allyst", "Ally", "Always by your side."] as const;

const flowConfig = `export default {
  projects: [{
    name: "website",
    platform: "web",
    framework: "html",
    baseUrl: "http://127.0.0.1:3000",
    routes: ["/"],
    flows: [{
      id: "open-dialog",
      name: "Open dialog",
      start: "/",
      steps: [
        { action: "click", locator: { role: "button", name: "Open" } },
        { action: "checkpoint", id: "dialog-open", name: "Dialog visible" },
      ],
    }],
  }],
};
`;

describe("CLI foundation", () => {
  it("prints help", async () => {
    const result = await runCli(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Usage:/);
    expect(result.stdout).toMatch(/a11yst/);
    expect(result.stdout).toMatch(/Your accessibility analyst\./);
    expect(result.stdout).toMatch(/Commands:/);
    expect(result.stdout).toMatch(/\bflows\b/);
    expect(result.stdout).toMatch(/\bdetect\b/);
    expect(result.stdout).toMatch(/\broutes\b/);
    expect(result.stdout).toMatch(/\baudit\b/);
    expect(result.stdout).toMatch(/\bprofiles\b/);
    expect(result.stdout).toMatch(/\binit\b/);
    expect(result.stdout).toMatch(/\bdoctor\b/);
    expect(result.stdout).toMatch(/\breport\b/);
    expect(result.stdout).toMatch(/\bbaseline\b/);
    expect(result.stdout).toMatch(/\bfindings\b/);
    expect(result.stdout).toMatch(/\bclassify\b/);
    expect(result.stdout).toMatch(/\bunclassify\b/);
    expect(result.stdout).toMatch(/--progress/);
    for (const marker of LEGACY_IDENTITY) {
      expect(result.stdout).not.toContain(marker);
    }

    const auditHelp = await runCli(["audit", "--help"]);
    expect(auditHelp.code).toBe(0);
    expect(auditHelp.stdout).toMatch(/--color/);

    const initHelp = await runCli(["init", "--help"]);
    expect(initHelp.code).toBe(0);
    expect(initHelp.stdout).toContain('"web"');
    expect(initHelp.stdout).not.toMatch(/react-native|expo/i);
    expect(result.stdout).not.toMatch(/react-native|expo/i);
  });

  it("prints version", async () => {
    const result = await runCli(["--version"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("1.0.0");
  });

  it("lists configured flows without a browser", async () => {
    await withTempDir("a11yst-cli-flows-", async (dir) => {
      await writeConfig(dir, flowConfig);
      const human = await runCli(["flows"], { cwd: dir });
      expect(human.code).toBe(0);
      expect(human.stdout).toMatch(/Flow|Steps|Start|Profiles/i);
      expect(human.stdout).toContain("open-dialog");

      const json = await runCli(["flows", "--json"], { cwd: dir });
      expect(json.code).toBe(0);
      const payload = JSON.parse(json.stdout) as {
        projects: Array<{ name: string; flows: Array<{ id: string }> }>;
      };
      expect(payload.projects[0]?.flows.map((flow) => flow.id)).toContain("open-dialog");
    });
  });

  it("exits 1 for an unknown flows project", async () => {
    await withTempDir("a11yst-cli-flows-missing-", async (dir) => {
      await writeConfig(dir, flowConfig);
      const result = await runCli(["flows", "--project", "missing-project"], { cwd: dir });
      expect(result.code).toBe(1);
      expect(result.stderr).toMatch(/Unknown project/i);
    });
  });

  it("init creates a web config and refuses overwrite without --force", async () => {
    await withTempDir("a11yst-init-", async (dir) => {
      const first = await runCli(["init"], { cwd: dir });
      expect(first.code).toBe(0);
      expect(first.stdout).toContain("Created");
      const configPath = join(dir, "a11yst.config.ts");
      await access(configPath);
      const contents = await readFile(configPath, "utf8");
      expect(contents).toContain("defineConfig");
      expect(contents).toContain('platform: "web"');

      const second = await runCli(["init"], { cwd: dir });
      expect(second.code).not.toBe(0);
      expect(second.stderr).toMatch(/already exists|--force/i);

      const forced = await runCli(["init", "--force", "--framework", "vue"], { cwd: dir });
      expect(forced.code).toBe(0);
      const updated = await readFile(configPath, "utf8");
      expect(updated).toContain('platform: "web"');
      expect(updated).toContain('framework: "vue"');
    });
  });

  it("doctor reports status and supports --json", async () => {
    await withTempDir("a11yst-doctor-", async (dir) => {
      await writeFile(
        join(dir, "a11yst.config.mjs"),
        `export default {
  projects: [{
    name: "website",
    platform: "web",
    framework: "html",
    baseUrl: "http://127.0.0.1:65530",
    routes: ["/"],
    profiles: ["default"],
    viewports: [{ name: "desktop", width: 1440, height: 900 }],
  }],
};
`,
        "utf8",
      );
      await writeFile(join(dir, "pnpm-lock.yaml"), "", "utf8");
      await writeFile(join(dir, "package.json"), JSON.stringify({ name: "temp-site" }), "utf8");
      await writeFile(join(dir, "index.html"), "<!doctype html><html></html>", "utf8");

      const human = await runCli(["doctor"], { cwd: dir });
      expect(human.code).toBe(0);
      expect(human.stdout).toMatch(/Overall status:\s+OK/i);
      expect(human.stdout).toMatch(/Node\.js version/i);

      const json = await runCli(["doctor", "--json"], { cwd: dir });
      expect(json.code).toBe(0);
      const payload = JSON.parse(json.stdout) as {
        status: string;
        checks: unknown[];
      };
      expect(payload.status).toBe("ok");
      expect(payload.checks.length).toBeGreaterThan(0);
    });
  });

  it("doctor still exits 0 and reports warn (not fail) when framework detection can't confirm the config", async () => {
    await withTempDir("a11yst-doctor-warn-", async (dir) => {
      await writeFile(
        join(dir, "a11yst.config.mjs"),
        `export default {
  projects: [{
    name: "website",
    platform: "web",
    framework: "html",
    baseUrl: "http://127.0.0.1:65530",
    routes: ["/"],
    profiles: ["default"],
    viewports: [{ name: "desktop", width: 1440, height: 900 }],
  }],
};
`,
        "utf8",
      );
      const result = await runCli(["doctor", "--json"], { cwd: dir });
      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as { status: string };
      expect(["ok", "warn"]).toContain(payload.status);
    });
  });
});
