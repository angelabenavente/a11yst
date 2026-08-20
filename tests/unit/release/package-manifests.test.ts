import { describe, expect, it } from "vitest";
import {
  computeRuntimeClosure,
  toMinimalPackageMap,
} from "../../helpers/release/package-graph.js";
import {
  findCliPackage,
  loadWorkspacePackages,
} from "../../helpers/release/workspace-packages.js";

describe("release package manifests", () => {
  it("keeps publishable runtime packages on a consistent provisional version", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const map = toMinimalPackageMap(packages);
    const { closure } = computeRuntimeClosure(map, cli.manifest.name);

    for (const name of closure) {
      const pkg = packages.find((entry) => entry.manifest.name === name);
      expect(pkg?.manifest.version).toBe("1.0.0");
      expect(pkg?.manifest.private).not.toBe(true);
    }
  });

  it("uses explicit dist and LICENSE allowlists for publishable packages", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const map = toMinimalPackageMap(packages);
    const { closure } = computeRuntimeClosure(map, cli.manifest.name);

    for (const name of closure) {
      const pkg = packages.find((entry) => entry.manifest.name === name)!;
      if (name === "@a11yst/cli") {
        expect(pkg.manifest.files).toEqual([
          "dist",
          "README.md",
          "LICENSE",
          "NOTICE.md",
          "TRADEMARKS.md",
        ]);
      } else {
        expect(pkg.manifest.files).toEqual(["dist", "LICENSE"]);
      }
    }
  });

  it("declares coherent entrypoints for the consumer CLI package", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;

    expect(cli.manifest.main).toBe("./dist/index.js");
    expect(cli.manifest.types).toBe("./dist/index.d.ts");
    expect(cli.manifest.bin?.a11yst).toBe("./dist/bin.js");
    expect(cli.manifest.exports).toMatchObject({
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
    });
  });

  it("requires MPL-2.0 license metadata on publishable manifests", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const map = toMinimalPackageMap(packages);
    const { closure } = computeRuntimeClosure(map, cli.manifest.name);

    for (const name of closure) {
      const pkg = packages.find((entry) => entry.manifest.name === name)!;
      expect(pkg.manifest.license).toBe("MPL-2.0");
      expect(pkg.manifest.repository).toBeUndefined();
      expect(pkg.manifest.homepage).toBeUndefined();
      expect(pkg.manifest.publishConfig).toBeUndefined();
    }
  });

  it("keeps runtime workspace dependencies inside the publishable closure", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const map = toMinimalPackageMap(packages);
    const { closure, issues } = computeRuntimeClosure(map, cli.manifest.name);
    const closureSet = new Set(closure);

    for (const name of closure) {
      const pkg = packages.find((entry) => entry.manifest.name === name)!;
      for (const dependency of Object.keys(pkg.manifest.dependencies ?? {})) {
        if (!dependency.startsWith("@a11yst/")) {
          continue;
        }
        expect(closureSet.has(dependency)).toBe(true);
      }
    }

    expect(issues).toEqual([]);
  });
});
