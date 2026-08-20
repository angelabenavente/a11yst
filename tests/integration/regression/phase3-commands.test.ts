import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli, withTempDir } from "../../helpers/cli.js";

/**
 * Phase 3 added a real browser engine (Playwright + Chromium) behind
 * `a11yst audit`. Phase 5 added `a11yst routes` for static route discovery.
 * This suite is a guardrail: `detect`, `init`, `doctor`, and `routes`
 * must stay purely static — they must never import `@a11yst/browser` or
 * launch a dev server / Chromium.
 *
 * We don't (and shouldn't) reach into process internals to assert "no
 * Chromium was spawned" directly; instead we lean on two simpler, stronger
 * signals:
 *   1. Source-level: `@a11yst/browser` only appears in the dependency graph
 *      of `@a11yst/core` (via `executeAudit`), and only the `audit` command
 *      calls into `@a11yst/core`. `detect`/`init`/`doctor` never import
 *      `@a11yst/core` or `@a11yst/browser` at all (asserted below via
 *      package.json dependency lists).
 *   2. Runtime: these commands finish almost instantly. Launching Chromium
 *      and/or waiting on a dev server takes at least hundreds of
 *      milliseconds to several seconds; a comfortable ceiling here would
 *      immediately fail if someone accidentally wired browser execution
 *      into these commands.
 */
const FAST_COMMAND_CEILING_MS = 5_000;

const validWebConfig = `export default {
  projects: [
    {
      name: "website",
      platform: "web",
      framework: "html",
      baseUrl: "http://127.0.0.1:65530",
      routes: ["/"],
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
};
`;

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, elapsedMs: Date.now() - start };
}

describe("Phase 3/5 regression: detect/init/doctor/routes never touch a browser or dev server", () => {
  it("detect finishes almost instantly and exits 0", async () => {
    await withTempDir("a11yst-phase3-detect-", async (dir) => {
      const { result, elapsedMs } = await timed(() => runCli(["detect", "--json"], { cwd: dir }));
      expect(result.code).toBe(0);
      expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);
    });
  });

  it("init finishes almost instantly and exits 0", async () => {
    await withTempDir("a11yst-phase3-init-", async (dir) => {
      const { result, elapsedMs } = await timed(() => runCli(["init", "--json"], { cwd: dir }));
      expect(result.code).toBe(0);
      expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);
    });
  });

  it("doctor finishes almost instantly and exits 0, even against a web config whose baseUrl is unreachable", async () => {
    await withTempDir("a11yst-phase3-doctor-", async (dir) => {
      // baseUrl deliberately points nowhere: if doctor ever tried to probe
      // or launch a browser against it, this would time out or fail slowly
      // instead of finishing quickly.
      await writeFile(join(dir, "a11yst.config.mjs"), validWebConfig, "utf8");
      const { result, elapsedMs } = await timed(() => runCli(["doctor", "--json"], { cwd: dir }));
      expect(result.code).toBe(0);
      expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);
    });
  });

  it("detect --workspace also finishes almost instantly", async () => {
    await withTempDir("a11yst-phase3-detect-ws-", async (dir) => {
      const { result, elapsedMs } = await timed(() =>
        runCli(["detect", "--json", "--workspace"], { cwd: dir }),
      );
      expect(result.code).toBe(0);
      expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);
    });
  });

  it("routes finishes almost instantly and never starts a dev server", async () => {
    await withTempDir("a11yst-phase5-routes-", async (dir) => {
      await writeFile(join(dir, "a11yst.config.mjs"), validWebConfig, "utf8");
      const { result, elapsedMs } = await timed(() => runCli(["routes", "--json"], { cwd: dir }));
      expect(result.code).toBe(0);
      expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);
    });
  });

  it("@a11yst/browser is not a direct CLI dependency; artifacts only for offline report writers", async () => {
    async function readManifest(pkg: string): Promise<{ dependencies?: Record<string, string> }> {
      const here = dirname(fileURLToPath(import.meta.url));
      const manifestPath = resolve(here, "../../../packages", pkg, "package.json");
      return JSON.parse(await readFile(manifestPath, "utf8")) as {
        dependencies?: Record<string, string>;
      };
    }

    const coreManifest = await readManifest("core");
    const cliManifest = await readManifest("cli");
    const detectManifest = await readManifest("detect");
    const configManifest = await readManifest("config");
    const here = dirname(fileURLToPath(import.meta.url));
    const reportSource = await readFile(
      resolve(here, "../../../packages/cli/src/commands/report.ts"),
      "utf8",
    );
    const cliSource = await readFile(
      resolve(here, "../../../packages/cli/src/index.ts"),
      "utf8",
    );

    expect(Object.keys(coreManifest.dependencies ?? {})).toContain("@a11yst/browser");
    // detect/config never depend on @a11yst/browser or @a11yst/core: they
    // are pure static-analysis packages, reused as-is by `detect`/`init`/`doctor`.
    expect(Object.keys(detectManifest.dependencies ?? {})).not.toContain("@a11yst/browser");
    expect(Object.keys(detectManifest.dependencies ?? {})).not.toContain("@a11yst/core");
    expect(Object.keys(configManifest.dependencies ?? {})).not.toContain("@a11yst/browser");
    expect(Object.keys(configManifest.dependencies ?? {})).not.toContain("@a11yst/core");
    // The CLI depends on @a11yst/core (for `audit`), which is how
    // @a11yst/browser reaches the CLI transitively — but only that one path.
    expect(Object.keys(cliManifest.dependencies ?? {})).toContain("@a11yst/core");
    expect(Object.keys(cliManifest.dependencies ?? {})).toContain("@a11yst/reporters");
    expect(Object.keys(cliManifest.dependencies ?? {})).toContain("@a11yst/artifacts");
    expect(Object.keys(cliManifest.dependencies ?? {})).not.toContain("@a11yst/browser");
    // `report --format` reads persisted results and writes offline via core input factories + artifact writers.
    expect(reportSource).toMatch(/@a11yst\/artifacts/);
    expect(reportSource).toMatch(/@a11yst\/core/);
    expect(reportSource).not.toMatch(/@a11yst\/browser|playwright/i);
    expect(cliSource).not.toMatch(/^import .*["']@a11yst\/core["'];?$/m);
  });
});
