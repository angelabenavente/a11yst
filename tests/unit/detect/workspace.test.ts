import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectProject, detectWorkspace } from "@a11yst/detect";
import { repoRoot, withTempDir, ensureDir } from "../../helpers/cli.js";

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

const monorepoFixture = join(repoRoot, "examples/detection/monorepo-apps");

describe("@a11yst/detect detectWorkspace", () => {
  it("detects apps/web but not packages/ui in the monorepo-apps fixture", async () => {
    const result = await detectWorkspace({ cwd: monorepoFixture });
    const relRoots = result.projects.map((p) => p.relativeRoot).sort();

    expect(relRoots).toEqual(["apps/web"]);
    expect(result.projects.some((p) => p.relativeRoot.startsWith("packages/"))).toBe(false);
    expect(result.workspaceRoot).toBe(monorepoFixture);
  });

  it("assigns the expected framework to the web app in monorepo-apps", async () => {
    const result = await detectWorkspace({ cwd: monorepoFixture });
    const byRoot = new Map(result.projects.map((p) => [p.relativeRoot, p]));

    expect(byRoot.get("apps/web")?.framework.framework).toBe("next");
  });

  it("detects a pnpm workspace with multiple apps in a temp directory", async () => {
    await withTempDir("ws-pnpm-", async (dir) => {
      await writeFile(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n', "utf8");
      await writeFile(join(dir, "pnpm-lock.yaml"), "", "utf8");
      await writeJson(join(dir, "package.json"), { name: "root", private: true });

      await ensureDir(join(dir, "apps/one"));
      await writeJson(join(dir, "apps/one/package.json"), {
        name: "one",
        scripts: { dev: "vite" },
        dependencies: { react: "^18.3.1" },
      });

      await ensureDir(join(dir, "apps/two"));
      await writeJson(join(dir, "apps/two/package.json"), {
        name: "two",
        scripts: { dev: "next dev" },
        dependencies: { next: "^15.0.0" },
      });

      const result = await detectWorkspace({ cwd: dir });
      expect(result.projects.map((p) => p.relativeRoot).sort()).toEqual(["apps/one", "apps/two"]);
      expect(result.packageManager.name).toBe("pnpm");
    });
  });

  it("detects an npm/yarn-style workspace via the package.json 'workspaces' field", async () => {
    await withTempDir("ws-npm-", async (dir) => {
      await writeJson(join(dir, "package.json"), {
        name: "root",
        private: true,
        workspaces: ["apps/*"],
      });

      await ensureDir(join(dir, "apps/a"));
      await writeJson(join(dir, "apps/a/package.json"), {
        name: "a",
        scripts: { dev: "vite" },
      });
      await ensureDir(join(dir, "apps/b"));
      await writeJson(join(dir, "apps/b/package.json"), {
        name: "b",
        scripts: { start: "next start" },
        dependencies: { next: "^15.0.0" },
      });

      const result = await detectWorkspace({ cwd: dir });
      expect(result.projects.map((p) => p.relativeRoot).sort()).toEqual(["apps/a", "apps/b"]);
    });
  });

  it("detects nested apps declared via a 'workspaces.packages' object field", async () => {
    await withTempDir("ws-nested-obj-", async (dir) => {
      await writeJson(join(dir, "package.json"), {
        name: "root",
        private: true,
        workspaces: { packages: ["packages/*"] },
      });

      await ensureDir(join(dir, "packages/nested-app"));
      await writeJson(join(dir, "packages/nested-app/package.json"), {
        name: "nested-app",
        scripts: { dev: "vite" },
      });

      const result = await detectWorkspace({ cwd: dir });
      expect(result.projects.map((p) => p.relativeRoot)).toEqual(["packages/nested-app"]);
    });
  });

  it("treats a workspace with no matching packages as an empty, single-project workspace", async () => {
    await withTempDir("ws-empty-", async (dir) => {
      await writeJson(join(dir, "package.json"), {
        name: "root",
        private: true,
        workspaces: [],
      });

      const result = await detectWorkspace({ cwd: dir });
      // An empty `workspaces` array has no patterns, so this falls back to
      // treating `cwd` itself as a single-project workspace.
      expect(
        result.diagnostics.some(
          (d) => d.code === "WORKSPACE_CONFIG_NOT_FOUND" || d.code === "WORKSPACE_NO_PACKAGES_FOUND",
        ),
      ).toBe(true);
    });
  });

  it("ignores library packages (no dev/start/serve script, has a library surface)", async () => {
    await withTempDir("ws-lib-", async (dir) => {
      await writeJson(join(dir, "package.json"), {
        name: "root",
        private: true,
        workspaces: ["packages/*"],
      });

      await ensureDir(join(dir, "packages/app-one"));
      await writeJson(join(dir, "packages/app-one/package.json"), {
        name: "app-one",
        scripts: { dev: "vite" },
      });

      await ensureDir(join(dir, "packages/lib-one"));
      await writeJson(join(dir, "packages/lib-one/package.json"), {
        name: "@scope/lib-one",
        main: "dist/index.js",
        types: "dist/index.d.ts",
        scripts: { build: "tsc" },
      });

      const result = await detectWorkspace({ cwd: dir });
      expect(result.projects.map((p) => p.relativeRoot)).toEqual(["packages/app-one"]);
    });
  });

  it("detects the same workspace whether called from the root or from a concrete app", async () => {
    const fromRoot = await detectWorkspace({ cwd: monorepoFixture });
    const fromApp = await detectProject({
      cwd: join(monorepoFixture, "apps/web"),
    });

    expect(fromApp.rootDir).toBe(join(monorepoFixture, "apps/web"));
    expect(fromApp.project.framework.framework).toBe("next");
    expect(fromRoot.projects.some((p) => p.rootDir === fromApp.rootDir)).toBe(true);
  });

  it("is deterministic across repeated calls", async () => {
    const [a, b] = await Promise.all([
      detectWorkspace({ cwd: monorepoFixture }),
      detectWorkspace({ cwd: monorepoFixture }),
    ]);
    expect(a.projects.map((p) => p.relativeRoot)).toEqual(b.projects.map((p) => p.relativeRoot));
    expect(a.projects.map((p) => p.framework.framework)).toEqual(
      b.projects.map((p) => p.framework.framework),
    );
  });
});
