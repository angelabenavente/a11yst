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
    for (const marker of LEGACY_IDENTITY) {
      expect(result.stdout).not.toContain(marker);
    }
  });

  it("prints version", async () => {
    const result = await runCli(["--version"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("0.1.0");
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
});
