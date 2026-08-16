import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findMissingExportTargets } from "../../helpers/release/export-targets.js";
import {
  computeRuntimeClosure,
  toMinimalPackageMap,
} from "../../helpers/release/package-graph.js";
import {
  findCliPackage,
  loadWorkspacePackages,
} from "../../helpers/release/workspace-packages.js";

describe("release package export targets", () => {
  it("resolves built export, types, main, module, and bin targets for publishable packages", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const map = toMinimalPackageMap(packages);
    const { closure } = computeRuntimeClosure(map, cli.manifest.name);

    const issues = (
      await Promise.all(
        closure.map(async (name) => {
          const pkg = packages.find((entry) => entry.manifest.name === name)!;
          return findMissingExportTargets(pkg);
        }),
      )
    ).flat();

    expect(issues).toEqual([]);
  });

  it("includes a shebang on the packaged CLI bin target", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const binTarget = cli.manifest.bin?.a11yst;
    expect(binTarget).toBeDefined();
    const binPath = join(cli.dirAbsolute, binTarget!);
    const source = await readFile(binPath, "utf8");
    expect(source.startsWith("#!/usr/bin/env node")).toBe(true);
  });
});
