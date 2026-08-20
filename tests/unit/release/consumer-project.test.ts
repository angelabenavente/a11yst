import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  A11YST_REGISTRY_GUARD,
  CONSUMER_ENTRY_PACKAGE,
  CONSUMER_PACKAGE_VERSION,
  buildConsumerProjectManifest,
  tarballFileName,
  toRelativeTarballReference,
  validateConsumerProjectManifest,
} from "../../helpers/release/consumer-install.js";
import {
  computeRuntimeClosure,
  toMinimalPackageMap,
} from "../../helpers/release/package-graph.js";
import {
  findCliPackage,
  loadWorkspacePackages,
} from "../../helpers/release/workspace-packages.js";

describe("consumer project manifest generation", () => {
  it("builds a manifest with only @a11yst/cli as a direct a11yst dependency", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const map = toMinimalPackageMap(packages);
    const { closure } = computeRuntimeClosure(map, cli.manifest.name);
    const consumerDir = await mkdtemp(join(tmpdir(), "a11yst-consumer-manifest-"));
    const packsDir = join(consumerDir, "..", "packs");
    const tarballByPackage = new Map(
      closure.map((name) => [name, join(packsDir, tarballFileName(name))]),
    );

    const manifest = buildConsumerProjectManifest({
      consumerDir,
      cliPackageName: CONSUMER_ENTRY_PACKAGE,
      publishableClosure: closure,
      tarballByPackage,
    });

    expect(Object.keys(manifest.dependencies)).toEqual([CONSUMER_ENTRY_PACKAGE]);
    expect(manifest.dependencies[CONSUMER_ENTRY_PACKAGE]).toBe(CONSUMER_PACKAGE_VERSION);
    expect(Object.keys(manifest.pnpm.overrides)).toHaveLength(closure.length);
    expect(manifest.pnpm.overrides[`${CONSUMER_ENTRY_PACKAGE}`]).toBe(
      toRelativeTarballReference(consumerDir, join(packsDir, tarballFileName(CONSUMER_ENTRY_PACKAGE))),
    );
    expect(validateConsumerProjectManifest(manifest)).toEqual([]);
  });

  it("uses stable override ordering and tarball paths relative to the consumer", async () => {
    const consumerDir = "/tmp/a11yst-13h/consumer";
    const packsDir = "/tmp/a11yst-13h/packs";
    const tarballByPackage = new Map([
      ["@a11yst/cli", join(packsDir, "a11yst-cli-1.0.0.tgz")],
      ["@a11yst/core", join(packsDir, "a11yst-core-1.0.0.tgz")],
      ["@a11yst/types", join(packsDir, "a11yst-types-1.0.0.tgz")],
    ]);

    const manifest = buildConsumerProjectManifest({
      consumerDir,
      cliPackageName: "@a11yst/cli",
      publishableClosure: ["@a11yst/types", "@a11yst/core", "@a11yst/cli"],
      tarballByPackage,
    });

    expect(Object.keys(manifest.pnpm.overrides)).toEqual([
      "@a11yst/cli",
      "@a11yst/core",
      "@a11yst/types",
    ]);
    expect(manifest.pnpm.overrides["@a11yst/core"]).toBe("file:../packs/a11yst-core-1.0.0.tgz");
    expect(manifest.dependencies["@a11yst/cli"]).toBe("1.0.0");
  });

  it("detects missing tarball and monorepo path issues", () => {
    const manifest = buildConsumerProjectManifest({
      consumerDir: "/tmp/consumer",
      cliPackageName: CONSUMER_ENTRY_PACKAGE,
      publishableClosure: ["@a11yst/types", CONSUMER_ENTRY_PACKAGE],
      tarballByPackage: new Map([
        [CONSUMER_ENTRY_PACKAGE, "/tmp/packs/a11yst-cli-1.0.0.tgz"],
        ["@a11yst/types", "/tmp/packs/a11yst-types-1.0.0.tgz"],
      ]),
    });

    manifest.dependencies["@a11yst/config"] = "1.0.0";
    manifest.pnpm.overrides["@a11yst/config"] = "workspace:*";

    const issues = validateConsumerProjectManifest(manifest);
    expect(issues).toContain("consumer-direct-a11yst-dependencies");
    expect(issues.some((issue) => issue.startsWith("workspace-protocol-in-override"))).toBe(true);
  });

  it("blocks the @a11yst registry with a dead-end registry URL", () => {
    expect(A11YST_REGISTRY_GUARD).toContain("@a11yst:registry=http://127.0.0.1:9/");
  });

  it("derives tarball names from package names and version", () => {
    expect(tarballFileName("@a11yst/cli")).toBe("a11yst-cli-1.0.0.tgz");
    expect(tarballFileName("@a11yst/source-analysis", CONSUMER_PACKAGE_VERSION)).toBe(
      "a11yst-source-analysis-1.0.0.tgz",
    );
  });

  it("collects a11yst package names from pnpm list JSON keyed dependencies", async () => {
    const { collectInstalledA11ystPackageNames } = await import("../../helpers/release/consumer-install.js");
    const payload = [
      {
        name: "a11yst-consumer-fixture",
        version: "0.0.0",
        path: "/tmp/consumer",
        dependencies: {
          "@a11yst/cli": {
            from: "@a11yst/cli",
            version: "1.0.0",
            path: "/tmp/consumer/node_modules/@a11yst/cli",
            dependencies: {
              "@a11yst/core": {
                from: "@a11yst/core",
                version: "1.0.0",
                path: "/tmp/consumer/node_modules/.pnpm/@a11yst+core@1.0.0/node_modules/@a11yst/core",
                dependencies: {
                  "@a11yst/types": {
                    from: "@a11yst/types",
                    version: "1.0.0",
                    path: "/tmp/consumer/node_modules/.pnpm/@a11yst+types@1.0.0/node_modules/@a11yst/types",
                  },
                },
              },
            },
          },
        },
      },
    ];

    expect(collectInstalledA11ystPackageNames(payload)).toEqual([
      "@a11yst/cli",
      "@a11yst/core",
      "@a11yst/types",
    ]);
  });
});
