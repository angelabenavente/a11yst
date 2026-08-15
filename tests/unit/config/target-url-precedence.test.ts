import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateConfig } from "@a11yst/config";
import { detectDevServers, type PackageManifest } from "@a11yst/detect";
import { withTempDir } from "../../helpers/cli.js";

describe("target URL resolution precedence", () => {
  it("uses vite.config server.port before Vite default 5173", async () => {
    await withTempDir("a11yst-detect-vite-port-", async (dir) => {
      const manifest: PackageManifest = {
        name: "vite-port-fixture",
        scripts: { dev: "vite" },
        devDependencies: { vite: "^5.4.0" },
      };
      await writeFile(join(dir, "package.json"), JSON.stringify(manifest, null, 2), "utf8");
      await writeFile(join(dir, "vite.config.ts"), `export default { server: { port: 3000 } };`, "utf8");

      const { devServers } = detectDevServers(dir, manifest, "pnpm", "react");
      expect(devServers[0]?.inferredPort).toBe(3000);
      expect(devServers[0]?.inferredUrl).toBe("http://localhost:3000");
      expect(devServers[0]?.inferredUrlSource).toBe("vite.config.ts · server.port");
    });
  });

  it("prefers explicit script port over vite.config server.port", async () => {
    await withTempDir("a11yst-detect-script-port-", async (dir) => {
      const manifest: PackageManifest = {
        name: "vite-script-port-fixture",
        scripts: { dev: "vite --port 4173" },
        devDependencies: { vite: "^5.4.0" },
      };
      await writeFile(join(dir, "package.json"), JSON.stringify(manifest, null, 2), "utf8");
      await writeFile(join(dir, "vite.config.ts"), `export default { server: { port: 3000 } };`, "utf8");

      const { devServers } = detectDevServers(dir, manifest, "pnpm", "react");
      expect(devServers[0]?.inferredPort).toBe(4173);
      expect(devServers[0]?.inferredUrlSource).toMatch(/script port/i);
    });
  });

  it("keeps explicit validated baseUrl authoritative over framework defaults", () => {
    const validated = validateConfig(
      {
        projects: [
          {
            name: "website",
            platform: "web",
            framework: "react",
            baseUrl: "http://localhost:3000",
            devServer: {
              command: "npm run dev",
              url: "http://localhost:3000",
            },
            routes: ["/"],
            profiles: ["default"],
          },
        ],
      },
      { configDir: "/tmp/a11yst-config" },
    );
    const project = validated.projects[0];
    expect(project?.platform).toBe("web");
    if (project && project.platform === "web") {
      expect(project.baseUrl).toBe("http://localhost:3000");
    }
  });
});
