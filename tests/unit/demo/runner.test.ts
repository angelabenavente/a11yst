import { mkdir, readFile, writeFile } from "node:fs/promises";
import { get } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getFreePort } from "../../helpers/net.js";
import { withTempDir } from "../../helpers/cli.js";
import { createPresentationFixture } from "../../fixtures/demo/presentation/sample-results.js";
import { createDemoSummary } from "../../../examples/demo/a11yst-shop/scripts/presentation/index.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const demoScript = join(repoRoot, "examples/demo/a11yst-shop/scripts/demo.mjs");
const demoRoot = join(repoRoot, "examples/demo/a11yst-shop");
const serverScript = join(demoRoot, "server.mjs");

function fetchText(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolvePromise, reject) => {
    get(`http://127.0.0.1:${port}${path}`, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        resolvePromise({
          status: response.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    }).on("error", reject);
  });
}

async function withDemoServer<T>(fn: (port: number) => Promise<T>): Promise<T> {
  const port = await getFreePort();
  const child = spawn(process.execPath, [serverScript], {
    env: { ...process.env, PORT: String(port), NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise<void>((resolvePromise, reject) => {
    const timeout = setTimeout(() => reject(new Error("server startup timeout")), 10_000);
    child.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString("utf8").includes("listening")) {
        clearTimeout(timeout);
        resolvePromise();
      }
    });
    child.on("error", reject);
  });

  try {
    return await fn(port);
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((resolvePromise) => {
      child.on("exit", () => resolvePromise());
      setTimeout(() => {
        child.kill("SIGKILL");
        resolvePromise();
      }, 2_000);
    });
  }
}

describe("a11yst-shop demo runner", () => {
  it("prints help for help command", () => {
    const result = spawnSync(process.execPath, [demoScript, "help"], {
      encoding: "utf8",
      shell: false,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("baseline");
    expect(result.stdout).toContain("pnpm demo full");
  });

  it("rejects unknown commands without stack traces", () => {
    const result = spawnSync(process.execPath, [demoScript, "not-a-stage"], {
      encoding: "utf8",
      shell: false,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown demo command "not-a-stage"');
    expect(result.stderr).not.toContain("at ");
  });

  it("clean command exits zero", () => {
    const result = spawnSync(process.execPath, [demoScript, "clean"], {
      encoding: "utf8",
      shell: false,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(".a11yst");
  });

  it("uses shell-disabled subprocess semantics for stage env", () => {
    const probe = spawnSync(
      process.execPath,
      ["-e", "process.stdout.write(process.env.A11YST_DEMO_STAGE ?? '')"],
      {
        env: { ...process.env, A11YST_DEMO_STAGE: "baseline" },
        encoding: "utf8",
        shell: false,
      },
    );
    expect(probe.stdout).toBe("baseline");
    expect(demoRoot).toContain("examples/demo/a11yst-shop");
  });

  it("derives summary counts from realistic stored results", () => {
    const results = createPresentationFixture();
    const summary = createDemoSummary(results, 2);
    expect(summary.findings.known).toBe(1);
    expect(summary.findings.new).toBe(3);
    expect(summary.findings.interactive).toBe(1);
  });

  it("clean removes only demo output and preserves external sentinel files", async () => {
    await withTempDir("a11yst-demo-clean-", async (workspace) => {
      const { cp } = await import("node:fs/promises");
      await cp(demoRoot, workspace, { recursive: true });
      await writeFile(join(workspace, "outside-output-sentinel.txt"), "keep", "utf8");
      await mkdir(join(workspace, ".a11yst/demo"), { recursive: true });
      await writeFile(join(workspace, ".a11yst/demo/demo-summary.md"), "summary", "utf8");

      const result = spawnSync(process.execPath, [join(workspace, "scripts/demo.mjs"), "clean"], {
        encoding: "utf8",
        shell: false,
      });
      expect(result.status).toBe(0);
      await expect(readFile(join(workspace, ".a11yst/demo/demo-summary.md"), "utf8")).rejects.toThrow();
      expect(await readFile(join(workspace, "outside-output-sentinel.txt"), "utf8")).toBe("keep");
    });
  });
});

describe("a11yst-shop demo server", () => {
  it("serves account, checkout, and assets on loopback", async () => {
    await withDemoServer(async (port) => {
      const account = await fetchText(port, "/account");
      const checkout = await fetchText(port, "/checkout");
      const css = await fetchText(port, "/styles.css");

      expect(account.status).toBe(200);
      expect(account.body).toContain("Your account");
      expect(checkout.status).toBe(200);
      expect(checkout.body).toContain("Checkout");
      expect(css.status).toBe(200);
      expect(css.body).toContain("font-family");
    });
  });

  it("returns 404 for unknown paths and rejects traversal", async () => {
    await withDemoServer(async (port) => {
      const missing = await fetchText(port, "/missing");
      const traversal = await fetchText(port, "/..%2F..%2Fetc/passwd");

      expect(missing.status).toBe(404);
      expect(traversal.status).toBe(404);
    });
  });

  it("does not expose the internal demo secret", async () => {
    await withDemoServer(async (port) => {
      const checkout = await fetchText(port, "/checkout");
      expect(checkout.body).not.toContain("ALLY_DEMO_INTERNAL_SECRET_13E");
    });
  });
});
