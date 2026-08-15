import { mkdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureDir, repoRoot, runCli, withTempDir } from "../../helpers/cli.js";

const fixturesRoot = join(repoRoot, "examples/detection");

/** Copy a handful of named files from a detection fixture into a temp dir, preserving relative paths. */
async function copyFixtureFiles(fixtureName: string, destDir: string, files: string[]): Promise<void> {
  for (const file of files) {
    const src = join(fixturesRoot, fixtureName, file);
    const dest = join(destDir, file);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
  }
}

describe("CLI detect", () => {
  it("mentions detect in top-level --help", async () => {
    const result = await runCli(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/detect/i);
  });

  it("shows dedicated help for the detect command", async () => {
    const result = await runCli(["detect", "--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/--json/);
    expect(result.stdout).toMatch(/--workspace/);
    expect(result.stdout).toMatch(/--cwd/);
  });

  it("shows URL source for vite.config server.port fixture", async () => {
    const result = await runCli(["detect", "--cwd", join(fixturesRoot, "react-vite-port-3000")]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("http://localhost:3000");
    expect(result.stdout).toMatch(/URL source\s+vite\.config\.ts · server\.port/);
  });

  it("detects next-app and prints 'next' with exit code 0", async () => {
    const result = await runCli(["detect", "--cwd", join(fixturesRoot, "next-app")]);
    expect(result.code).toBe(0);
    expect(result.stdout.toLowerCase()).toContain("next");
  });

  it("emits valid JSON with framework 'next' via --json", async () => {
    const result = await runCli([
      "detect",
      "--json",
      "--cwd",
      join(fixturesRoot, "next-app"),
    ]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      kind: string;
      project: { framework: { framework: string; confidence: string } };
    };
    expect(payload.kind).toBe("project");
    expect(payload.project.framework.framework).toBe("next");
    expect(["certain", "high"]).toContain(payload.project.framework.confidence);
  });

  it("detects the html fixture via --cwd", async () => {
    const result = await runCli(["detect", "--json", "--cwd", join(fixturesRoot, "html")]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as { project: { framework: { framework: string } } };
    expect(payload.project.framework.framework).toBe("html");
  });

  it("detects the web app in the monorepo-apps workspace with --workspace", async () => {
    const result = await runCli([
      "detect",
      "--json",
      "--workspace",
      "--cwd",
      join(fixturesRoot, "monorepo-apps"),
    ]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      kind: string;
      projects: Array<{ relativeRoot: string; framework: { framework: string } }>;
    };
    expect(payload.kind).toBe("workspace");
    const byRoot = new Map(payload.projects.map((p) => [p.relativeRoot, p.framework.framework]));
    expect(byRoot.get("apps/web")).toBe("next");
    expect(byRoot.has("packages/ui")).toBe(false);
  });

  it("detects the ambiguous fixture, exposing an alternative and ambiguity signal", async () => {
    const result = await runCli(["detect", "--json", "--cwd", join(fixturesRoot, "ambiguous")]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      project: {
        framework: {
          framework: string;
          confidence: string;
          alternatives: Array<{ framework: string }>;
          diagnostics: Array<{ code: string }>;
        };
      };
    };
    const framework = payload.project.framework;
    expect(framework.alternatives.length).toBeGreaterThan(0);
    const ambiguous =
      framework.diagnostics.some((d) => d.code === "FRAMEWORK_AMBIGUOUS") ||
      framework.confidence === "medium" ||
      framework.confidence === "low";
    expect(ambiguous).toBe(true);
  });

  it("detects the unknown-empty fixture as framework unknown", async () => {
    const result = await runCli(["detect", "--json", "--cwd", join(fixturesRoot, "unknown-empty")]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as { project: { framework: { framework: string } } };
    expect(payload.project.framework.framework).toBe("unknown");
  });

  it("detects angular, vue, and nuxt fixtures", async () => {
    for (const [fixtureName, expected] of [
      ["angular-app", "angular"],
      ["vue-vite", "vue"],
      ["nuxt-app", "nuxt"],
    ] as const) {
      const result = await runCli(["detect", "--json", "--cwd", join(fixturesRoot, fixtureName)]);
      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as { project: { framework: { framework: string } } };
      expect(payload.project.framework.framework).toBe(expected);
    }
  });
});

describe("CLI robustness", () => {
  it("works from a directory whose name contains spaces", async () => {
    await withTempDir("a11yst detect space-", async (parent) => {
      const dir = join(parent, "my detected project");
      await ensureDir(dir);
      await copyFixtureFiles("html", dir, ["package.json", "index.html", "about.html", "serve.mjs"]);

      const result = await runCli(["detect", "--json"], { cwd: dir });
      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as { project: { framework: { framework: string } } };
      expect(payload.project.framework.framework).toBe("html");
    });
  });
});
