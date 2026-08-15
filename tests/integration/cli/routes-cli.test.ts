import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adapterFixture } from "../../helpers/adapters.js";
import { repoRoot, runCli, withTempDir } from "../../helpers/cli.js";

async function writeRoutesConfig(
  dir: string,
  project: {
    name: string;
    framework: string;
    rootDir: string;
    routes?: string[];
    routeDiscovery?: Record<string, unknown>;
  },
): Promise<void> {
  const config = `export default {
  projects: [{
    name: ${JSON.stringify(project.name)},
    platform: "web",
    framework: ${JSON.stringify(project.framework)},
    rootDir: ${JSON.stringify(project.rootDir)},
    baseUrl: "http://localhost:3000",
    ${project.routes ? `routes: ${JSON.stringify(project.routes)},` : ""}
    ${project.routeDiscovery ? `routeDiscovery: ${JSON.stringify(project.routeDiscovery)},` : ""}
    profiles: ["default"],
    viewports: [{ name: "desktop", width: 1280, height: 720 }],
  }],
};
`;
  await writeFile(join(dir, "a11yst.config.mjs"), config, "utf8");
}

describe("CLI routes", () => {
  it("mentions routes in top-level --help", async () => {
    const result = await runCli(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/\broutes\b/i);
  });

  it("discovers html fixture routes via --json without starting a browser", async () => {
    await withTempDir("a11yst-routes-html-", async (dir) => {
      const fixture = adapterFixture("html");
      await writeRoutesConfig(dir, {
        name: "site",
        framework: "html",
        rootDir: fixture,
        routeDiscovery: { mode: "merge" },
      });

      const result = await runCli(["routes", "--json"], { cwd: dir });
      expect(result.code).toBe(0);
      expect(result.stderr).toBe("");

      const payload = JSON.parse(result.stdout) as {
        projects: Array<{
          name: string;
          framework: string;
          adapterId: string;
          routes: Array<{ path: string; origin: string }>;
        }>;
      };

      expect(payload.projects).toHaveLength(1);
      expect(payload.projects[0]?.framework).toBe("html");
      expect(payload.projects[0]?.adapterId).toBe("html");
      const paths = payload.projects[0]?.routes.map((route) => route.path).sort();
      expect(paths).toEqual(["/", "/about.html", "/about/", "/docs/guide/"].sort());
      expect(payload.projects[0]?.routes.some((route) => route.origin === "filesystem")).toBe(
        true,
      );
    });
  });

  it("discovers next app-router routes and reports skipped dynamic patterns", async () => {
    await withTempDir("a11yst-routes-next-", async (dir) => {
      const fixture = adapterFixture("next/app-router");
      await writeRoutesConfig(dir, {
        name: "web",
        framework: "next",
        rootDir: fixture,
        routeDiscovery: { mode: "merge", samples: {} },
      });

      const result = await runCli(["routes", "--json"], { cwd: dir });
      expect(result.code).toBe(0);

      const payload = JSON.parse(result.stdout) as {
        projects: Array<{
          routes: Array<{ path: string }>;
          skippedPatterns: Array<{ pattern: string }>;
        }>;
      };

      const project = payload.projects[0];
      expect(project?.routes.map((route) => route.path).sort()).toEqual([
        "/",
        "/about",
        "/pricing",
      ]);
      expect(project?.skippedPatterns.map((entry) => entry.pattern).sort()).toEqual([
        "/blog/:slug",
        "/docs/:...slug",
      ]);
    });
  });

  it("filters projects with --project", async () => {
    await withTempDir("a11yst-routes-filter-", async (dir) => {
      const htmlFixture = adapterFixture("html");
      const config = `export default {
  projects: [
    {
      name: "site-a",
      platform: "web",
      framework: "html",
      rootDir: ${JSON.stringify(htmlFixture)},
      baseUrl: "http://localhost:3000",
      routeDiscovery: { mode: "merge" },
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    },
    {
      name: "site-b",
      platform: "web",
      framework: "html",
      rootDir: ${JSON.stringify(htmlFixture)},
      baseUrl: "http://localhost:3000",
      routeDiscovery: { mode: "merge" },
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    },
  ],
};
`;
      await writeFile(join(dir, "a11yst.config.mjs"), config, "utf8");

      const result = await runCli(["routes", "--json", "--project", "site-b"], { cwd: dir });
      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as { projects: Array<{ name: string }> };
      expect(payload.projects.map((entry) => entry.name)).toEqual(["site-b"]);
    });
  });

  it("emits human-readable output by default", async () => {
    await withTempDir("a11yst-routes-human-", async (dir) => {
      await writeRoutesConfig(dir, {
        name: "site",
        framework: "html",
        rootDir: adapterFixture("html"),
        routeDiscovery: { mode: "merge" },
      });

      const result = await runCli(["routes"], { cwd: dir });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Resolved routes");
      expect(result.stdout).toContain("Routes:");
      expect(() => JSON.parse(result.stdout)).toThrow();
    });
  });

  it("discovers react router routes from a comprehensive fixture", async () => {
    await withTempDir("a11yst-routes-react-", async (dir) => {
      const fixture = adapterFixture("react/comprehensive");
      await writeRoutesConfig(dir, {
        name: "web",
        framework: "react",
        rootDir: fixture,
        routeDiscovery: { mode: "merge" },
      });

      const result = await runCli(["routes", "--json"], { cwd: dir });
      expect(result.code).toBe(0);

      const payload = JSON.parse(result.stdout) as {
        projects: Array<{
          routes: Array<{ path: string; origin: string }>;
          skippedPatterns: Array<{ pattern: string }>;
          explain?: { fallbackUsed: boolean; routerDetected: boolean };
        }>;
      };

      const project = payload.projects[0];
      expect(project?.routes.map((route) => route.path).sort()).toEqual([
        "/",
        "/about",
        "/contact",
        "/projects",
        "/projects/featured",
      ]);
      expect(project?.routes.some((route) => route.origin === "react-jsx-route")).toBe(true);
      expect(project?.skippedPatterns.map((entry) => entry.pattern)).toEqual(["/projects/:slug"]);
      expect(project?.explain?.fallbackUsed).toBe(false);
      expect(project?.explain?.routerDetected).toBe(true);
    });
  });

  it("shows explain output for react routes", async () => {
    await withTempDir("a11yst-routes-react-explain-", async (dir) => {
      const fixture = adapterFixture("react/comprehensive");
      await writeRoutesConfig(dir, {
        name: "web",
        framework: "react",
        rootDir: fixture,
        routeDiscovery: { mode: "merge" },
      });

      const result = await runCli(["routes", "--explain"], { cwd: dir });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Explain:");
      expect(result.stdout).toContain("Router detected");
      expect(result.stdout).toContain("react-router");
      expect(result.stdout).toContain("! /projects/:slug");
      expect(result.stdout).not.toMatch(/Fallback\s*\n\s*yes/i);
    });
  });

  it("works from the repository root config layout used by other CLI tests", async () => {
    await withTempDir("a11yst-routes-layout-", async (dir) => {
      await writeRoutesConfig(dir, {
        name: "site",
        framework: "nuxt",
        rootDir: join(repoRoot, "tests/fixtures/adapters/nuxt"),
        routeDiscovery: { mode: "merge", samples: {} },
      });

      const result = await runCli(["routes", "--json", "--cwd", dir]);
      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        projects: Array<{ framework: string; routes: Array<{ path: string }> }>;
      };
      expect(payload.projects[0]?.framework).toBe("nuxt");
      expect(payload.projects[0]?.routes.map((route) => route.path).sort()).toEqual([
        "/",
        "/about",
      ]);
    });
  });
});
