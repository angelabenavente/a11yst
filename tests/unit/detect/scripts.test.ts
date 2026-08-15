import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildDevCommand, detectDevServers } from "@a11yst/detect";
import type { PackageManifest } from "@a11yst/detect";

const ROOT = "/tmp/a11yst-scripts-test";

function manifestWith(scripts: Record<string, string>, extra: Partial<PackageManifest> = {}): PackageManifest {
  return { name: "fixture", scripts, ...extra };
}

describe("@a11yst/detect detectDevServers", () => {
  it("finds a devServer candidate for a plain 'dev' script", () => {
    const { devServers, diagnostics } = detectDevServers(
      ROOT,
      manifestWith({ dev: "vite" }),
      "pnpm",
      "unknown",
    );
    expect(devServers).toHaveLength(1);
    expect(devServers[0]?.sourceScript).toBe("dev");
    expect(devServers[0]?.command).toBe("pnpm dev");
    // No explicit port and no applicable default for framework "unknown" without vite dep.
    expect(devServers[0]?.inferredUrl).toBeUndefined();
    expect(diagnostics.some((d) => d.code === "DEV_SERVER_PORT_UNKNOWN")).toBe(true);
  });

  it("finds a devServer candidate for a plain 'start' script", () => {
    const { devServers } = detectDevServers(
      ROOT,
      manifestWith({ start: "node server.js" }),
      "npm",
      "unknown",
    );
    expect(devServers).toHaveLength(1);
    expect(devServers[0]?.sourceScript).toBe("start");
    expect(devServers[0]?.command).toBe("npm run start");
  });

  it("parses an explicit --port flag", () => {
    const { devServers } = detectDevServers(
      ROOT,
      manifestWith({ dev: "vite --port 4173" }),
      "pnpm",
      "react",
    );
    expect(devServers[0]?.inferredPort).toBe(4173);
    expect(devServers[0]?.inferredUrl).toBe("http://localhost:4173");
    expect(devServers[0]?.confidence).toBe("high");
  });

  it("parses an explicit PORT=xxxx environment assignment", () => {
    const { devServers } = detectDevServers(
      ROOT,
      manifestWith({ dev: "PORT=4173 node server.js" }),
      "npm",
      "unknown",
    );
    expect(devServers[0]?.inferredPort).toBe(4173);
    expect(devServers[0]?.inferredUrl).toBe("http://localhost:4173");
  });

  it("uses statically declared vite.config server.port before framework default", () => {
    const dir = mkdtempSync(join(tmpdir(), "a11yst-vite-port-"));
    writeFileSync(join(dir, "vite.config.ts"), "export default { server: { port: 3000 } };", "utf8");

    const { devServers } = detectDevServers(
      dir,
      manifestWith({ dev: "vite" }, { devDependencies: { vite: "^5.4.0" } }),
      "pnpm",
      "react",
    );
    expect(devServers[0]?.inferredPort).toBe(3000);
    expect(devServers[0]?.inferredUrlSource).toBe("vite.config.ts · server.port");
  });

  it("falls back to the well-known default port for vite when no explicit port is given", () => {
    const { devServers } = detectDevServers(
      ROOT,
      manifestWith({ dev: "vite" }, { devDependencies: { vite: "^5.4.0" } }),
      "pnpm",
      "unknown",
    );
    expect(devServers[0]?.inferredPort).toBe(5173);
    expect(devServers[0]?.confidence).toBe("medium");
    expect(devServers[0]?.evidence.some((e) => e.type === "fallback")).toBe(true);
  });

  it("known framework defaults infer a port even without a vite dependency", () => {
    const { devServers } = detectDevServers(ROOT, manifestWith({ dev: "next dev" }), "npm", "next");
    expect(devServers[0]?.inferredPort).toBe(3000);
  });

  it("does not invent a URL for a complex, unparseable script", () => {
    const { devServers, diagnostics } = detectDevServers(
      ROOT,
      manifestWith({ dev: 'concurrently "npm:dev:*"' }),
      "npm",
      "unknown",
    );
    expect(devServers).toHaveLength(1);
    expect(devServers[0]?.command).toBe("npm run dev");
    expect(devServers[0]?.inferredUrl).toBeUndefined();
    expect(devServers[0]?.inferredPort).toBeUndefined();
    expect(devServers[0]?.confidence).toBe("low");
    expect(diagnostics.some((d) => d.code === "DEV_SERVER_PORT_UNKNOWN")).toBe(true);
  });

  it("does not invent a URL when there is no port evidence and no applicable default", () => {
    const { devServers } = detectDevServers(
      ROOT,
      manifestWith({ dev: "webpack serve" }),
      "npm",
      "unknown",
    );
    expect(devServers[0]?.inferredUrl).toBeUndefined();
    expect(devServers[0]?.inferredPort).toBeUndefined();
  });

  it("reports a diagnostic and an empty list when no dev/start/serve/develop scripts exist", () => {
    const { devServers, diagnostics } = detectDevServers(ROOT, manifestWith({}), "npm", "unknown");
    expect(devServers).toHaveLength(0);
    expect(diagnostics.some((d) => d.code === "DEV_SERVER_NOT_FOUND")).toBe(true);
  });

  it("reports a diagnostic and an empty list when manifest is undefined", () => {
    const { devServers, diagnostics } = detectDevServers(ROOT, undefined, "npm", "unknown");
    expect(devServers).toHaveLength(0);
    expect(diagnostics.some((d) => d.code === "DEV_SERVER_NOT_FOUND")).toBe(true);
  });

  it.each([
    ["pnpm", "pnpm dev"],
    ["npm", "npm run dev"],
    ["yarn", "yarn dev"],
    ["bun", "bun run dev"],
  ] as const)("uses the matching command prefix for %s", (packageManager, expectedCommand) => {
    const { devServers } = detectDevServers(
      ROOT,
      manifestWith({ dev: "vite" }),
      packageManager,
      "react",
    );
    expect(devServers[0]?.command).toBe(expectedCommand);
    expect(buildDevCommand(packageManager, "dev")).toBe(expectedCommand);
  });

  it("unknown package manager falls back to an npm-style command", () => {
    expect(buildDevCommand("unknown", "dev")).toBe("npm run dev");
  });

  it("preserves DEV_SCRIPT_NAMES preference order in the returned array", () => {
    const { devServers } = detectDevServers(
      ROOT,
      manifestWith({ develop: "custom-develop", start: "node server.js", dev: "vite" }),
      "npm",
      "unknown",
    );
    expect(devServers.map((d) => d.sourceScript)).toEqual(["dev", "start", "develop"]);
  });
});
