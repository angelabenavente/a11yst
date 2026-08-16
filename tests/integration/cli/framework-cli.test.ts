import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot, runCli, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const FAST_COMMAND_CEILING_MS = 5_000;
const AUDIT_TIMEOUT_MS = 120_000;

const frameworkExample = (name: string) => join(repoRoot, "examples/frameworks", name);

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, elapsedMs: Date.now() - start };
}

describe.sequential("Phase 5 framework CLI integration", () => {
  it("routes --cwd html-site emits human-readable output", async () => {
    const { result, elapsedMs } = await timed(() =>
      runCli(["routes"], { cwd: frameworkExample("html-site") }),
    );

    expect(result.code).toBe(0);
    expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);
    expect(result.stdout).toContain("Resolved routes");
    expect(result.stdout).toContain("framework-html-site");
    expect(result.stdout).toContain("Adapter");
    expect(result.stdout).toContain("html");
    expect(result.stdout).toMatch(/\/about\/?/);
    expect(() => JSON.parse(result.stdout)).toThrow();
  });

  it("routes --cwd html-site --json lists discovered routes and adapter metadata", async () => {
    const { result, elapsedMs } = await timed(() =>
      runCli(["routes", "--json"], { cwd: frameworkExample("html-site") }),
    );

    expect(result.code).toBe(0);
    expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);

    const payload = JSON.parse(result.stdout) as {
      projects: Array<{
        name: string;
        adapterId: string;
        routes: Array<{ path: string; origin: string }>;
      }>;
    };

    expect(payload.projects).toHaveLength(1);
    expect(payload.projects[0]?.adapterId).toBe("html");
    expect(payload.projects[0]?.routes.map((route) => route.path).sort()).toEqual([
      "/",
      "/about/",
    ]);
    expect(payload.projects[0]?.routes.some((route) => route.origin === "filesystem")).toBe(
      true,
    );
  });

  it("routes --cwd next-app --json shows sampled routes and skipped dynamic patterns", async () => {
    const { result, elapsedMs } = await timed(() =>
      runCli(["routes", "--json"], { cwd: frameworkExample("next-app") }),
    );

    expect(result.code).toBe(0);
    expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);

    const payload = JSON.parse(result.stdout) as {
      projects: Array<{
        adapterId: string;
        routes: Array<{ path: string }>;
        skippedPatterns: Array<{ pattern: string }>;
      }>;
    };

    const project = payload.projects[0];
    expect(project?.adapterId).toBe("next");
    expect(project?.routes.map((route) => route.path).sort()).toEqual([
      "/",
      "/about",
      "/products/example",
    ]);
    const hasSampledDynamic = project?.routes.some((route) => route.path === "/products/example");
    const hasSkippedDynamic = project?.skippedPatterns.some((entry) =>
      entry.pattern.includes(":"),
    );
    expect(hasSampledDynamic || hasSkippedDynamic).toBe(true);
  });

  it(
    "audit --cwd html-site --output temp exits 0 even when findings exist",
    async () => {
      await withTempDir("a11yst-framework-cli-audit-", async (output) => {
        const port = await getFreePort();
        const result = await runCli(["audit", "--output", output], {
          cwd: frameworkExample("html-site"),
          env: { PORT: String(port) },
        });

        expect(result.code).toBe(0);
        expect(result.stdout).toMatch(/Audit ID:/);
      });
    },
    AUDIT_TIMEOUT_MS,
  );

  it(
    "audit --json includes adapter metadata on completed runs",
    async () => {
      await withTempDir("a11yst-framework-cli-json-", async (output) => {
        const port = await getFreePort();
        const result = await runCli(["audit", "--json", "--output", output], {
          cwd: frameworkExample("html-site"),
          env: { PORT: String(port) },
        });

        expect(result.code).toBe(0);
        const payload = JSON.parse(result.stdout) as {
          status: string;
          runs: Array<{ adapter?: { adapterId: string; routeOrigin?: string } }>;
        };

        expect(payload.status).toBe("completed");
        expect(payload.runs.some((run) => run.adapter?.adapterId === "html")).toBe(true);
        expect(payload.runs.some((run) => run.adapter?.routeOrigin === "filesystem")).toBe(true);
      });
    },
    AUDIT_TIMEOUT_MS,
  );

  it("routes finishes quickly without starting a dev server", async () => {
    const { result, elapsedMs } = await timed(() =>
      runCli(["routes", "--json"], { cwd: frameworkExample("next-app") }),
    );
    expect(result.code).toBe(0);
    expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);
  });

  it("detect finishes quickly without starting a dev server", async () => {
    const { result, elapsedMs } = await timed(() =>
      runCli(["detect", "--json"], { cwd: frameworkExample("react-vite") }),
    );
    expect(result.code).toBe(0);
    expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);
  });

  it("init finishes quickly without starting a dev server", async () => {
    await withTempDir("a11yst-framework-cli-init-", async (dir) => {
      const { result, elapsedMs } = await timed(() =>
        runCli(["init", "--json", "--force"], { cwd: dir }),
      );
      expect(result.code).toBe(0);
      expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);
    });
  });

  it("doctor finishes quickly without starting a dev server", async () => {
    const { result, elapsedMs } = await timed(() =>
      runCli(["doctor", "--json"], { cwd: frameworkExample("vue-vite") }),
    );
    expect(result.code).toBe(0);
    expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);
  });
});
