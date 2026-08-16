import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  computeRuntimeClosure,
  toMinimalPackageMap,
  topologicalPublishOrder,
} from "../../helpers/release/package-graph.js";
import {
  buildPackageMap,
  findCliPackage,
  loadWorkspacePackages,
} from "../../helpers/release/workspace-packages.js";

const fixtureRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/release/package-graph/private-runtime-dependency/packages",
);

describe("release package graph", () => {
  it("finds the CLI package by bin.a11yst", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages);
    expect(cli?.manifest.name).toBe("@a11yst/cli");
    expect(cli?.manifest.bin?.a11yst).toBe("./dist/bin.js");
  });

  it("computes a deterministic runtime closure for the CLI", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages);
    expect(cli).toBeDefined();

    const map = toMinimalPackageMap(packages);
    const first = computeRuntimeClosure(map, cli!.manifest.name);
    const second = computeRuntimeClosure(map, cli!.manifest.name);

    expect(first.closure).toEqual(second.closure);
    expect(first.closure[0]).toBe("@a11yst/adapters");
    expect(first.closure).toContain("@a11yst/cli");
    expect(first.closure).toContain("@a11yst/core");
    expect(first.closure).toContain("@a11yst/source-analysis");
    expect(first.issues).toEqual([]);
  });

  it("orders publishable packages topologically with stable tie-breaking", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const map = toMinimalPackageMap(packages);
    const { closure } = computeRuntimeClosure(map, cli.manifest.name);
    const order = topologicalPublishOrder(map, closure);

    expect(order[0]).toBe("@a11yst/types");
    expect(order.at(-1)).toBe("@a11yst/cli");
    expect(new Set(order)).toEqual(new Set(closure));
  });

  it("does not include devDependencies in the runtime closure", async () => {
    const packages = await loadWorkspacePackages();
    const packageMap = buildPackageMap(packages);
    const cli = findCliPackage(packages)!;

    for (const dependency of Object.keys(cli.manifest.devDependencies ?? {})) {
      expect(packageMap.has(dependency)).toBe(false);
    }
  });

  it("detects private runtime dependencies in negative fixture", async () => {
    const entries = ["cli", "runtime", "private-helper"] as const;
    const records = await Promise.all(
      entries.map(async (entry) => {
        const manifest = JSON.parse(
          await readFile(join(fixtureRoot, entry, "package.json"), "utf8"),
        ) as {
          name: string;
          private?: boolean;
          dependencies?: Record<string, string>;
        };
        return [manifest.name, manifest] as const;
      }),
    );

    const map = new Map(records);
    const result = computeRuntimeClosure(map, "@fixture/cli");

    expect(result.closure).toEqual(["@fixture/cli", "@fixture/private-helper", "@fixture/runtime"]);
    expect(result.issues).toEqual([
      {
        kind: "private-runtime-dependency",
        packageName: "@fixture/runtime",
        dependency: "@fixture/private-helper",
      },
    ]);
  });
});
