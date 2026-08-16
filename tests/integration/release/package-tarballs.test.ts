import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeRuntimeClosure,
  toMinimalPackageMap,
  topologicalPublishOrder,
} from "../../helpers/release/package-graph.js";
import {
  compareSemanticPackResults,
  findWorkspaceProtocolInManifest,
  packAllowlistExcludesSensitiveFiles,
  packPackage,
  readTarballPackageFile,
  scanTarballForSensitiveValues,
} from "../../helpers/release/pack-inspect.js";
import {
  findCliPackage,
  getRepoRoot,
  loadWorkspacePackages,
} from "../../helpers/release/workspace-packages.js";
import { withTempDir } from "../../helpers/cli.js";

const SECRET = "A11YST_PACK_SECRET_13G";

function assertRequiredFilesPresent(files: string[], requiredFiles: string[]): void {
  for (const required of requiredFiles) {
    if (required.endsWith("/") || !required.includes(".")) {
      expect(files.some((file) => file === required || file.startsWith(`${required}/`))).toBe(true);
      continue;
    }
    expect(files).toContain(required);
  }
}

describe("release package tarballs", () => {
  it(
    "packs the publishable runtime closure with valid manifests and allowlisted contents",
    async () => {
      const repoRoot = getRepoRoot();
      const packages = await loadWorkspacePackages();
      const cli = findCliPackage(packages)!;
      const map = toMinimalPackageMap(packages);
      const { closure } = computeRuntimeClosure(map, cli.manifest.name);
      const order = topologicalPublishOrder(map, closure);
      const publishable = order.map(
        (name) => packages.find((entry) => entry.manifest.name === name)!,
      );

      await withTempDir("a11yst-pack-run1-", async (runOne) => {
        await withTempDir("a11yst-pack-run2-", async (runTwo) => {
          const runOneResults = [];
          const runTwoResults = [];

          for (const pkg of publishable) {
            const destinationOne = join(runOne, pkg.manifest.name.replace("/", "__"));
            const destinationTwo = join(runTwo, pkg.manifest.name.replace("/", "__"));
            const { mkdir } = await import("node:fs/promises");
            await mkdir(destinationOne, { recursive: true });
            await mkdir(destinationTwo, { recursive: true });

            runOneResults.push(await packPackage(pkg, destinationOne));
            runTwoResults.push(await packPackage(pkg, destinationTwo));
          }

          expect(runOneResults).toHaveLength(publishable.length);
          expect(runTwoResults).toHaveLength(publishable.length);

          for (let index = 0; index < runOneResults.length; index += 1) {
            const first = runOneResults[index]!;
            const second = runTwoResults[index]!;
            const comparison = compareSemanticPackResults(first, second);
            expect(comparison.equal, comparison.differences.join(", ")).toBe(true);
          }

          const cliPack = runOneResults.find((result) => result.packageName === "@a11yst/cli");
          expect(cliPack).toBeDefined();
          expect(findWorkspaceProtocolInManifest(cliPack!.manifest)).toEqual([]);
          assertRequiredFilesPresent(cliPack!.files, cliPack!.requiredFiles);
          expect(cliPack!.unexpectedFiles).toEqual([]);
          expect(cliPack!.files.some((file) => file.startsWith("package/dist/"))).toBe(true);
          expect(cliPack!.files).toContain("package/dist/bin.js");
          expect(cliPack!.files).toContain("package/README.md");
          expect(cliPack!.files).toContain("package/LICENSE");
          expect(cliPack!.files).toContain("package/NOTICE.md");
          expect(cliPack!.files).toContain("package/TRADEMARKS.md");
          expect(cliPack!.manifest.license).toBe("MPL-2.0");
          const rootLicense = await readFile(join(repoRoot, "LICENSE"), "utf8");
          const packedLicense = await readTarballPackageFile(cliPack!.tarball, "LICENSE");
          expect(packedLicense).toBe(rootLicense);
          expect(cliPack!.files.some((file) => file.startsWith("package/src/"))).toBe(false);
          expect(cliPack!.files.some((file) => file.startsWith("package/tests/"))).toBe(false);
          expect(cliPack!.files.some((file) => file.includes("node_modules"))).toBe(false);

          const sensitiveMatches = await scanTarballForSensitiveValues(cliPack!.tarball, [
            SECRET,
            repoRoot,
          ]);
          expect(sensitiveMatches).toEqual([]);

          for (const result of runOneResults) {
            expect(findWorkspaceProtocolInManifest(result.manifest)).toEqual([]);
            expect(result.unexpectedFiles).toEqual([]);
            assertRequiredFilesPresent(result.files, result.requiredFiles);
            expect(result.manifest.license).toBe("MPL-2.0");
            expect(result.files).toContain("package/LICENSE");
            const packedLicense = await readTarballPackageFile(result.tarball, "LICENSE");
            expect(packedLicense).toBe(rootLicense);
            expect(result.sizeBytes).toBeGreaterThan(0);
            expect(result.sizeBytes).toBeLessThan(50 * 1024 * 1024);
            expect(result.files.some((file) => /(^|\/)website(\/|$)/.test(file))).toBe(false);
            expect(result.files.some((file) => /(^|\/)\.a11yst(\/|$)/.test(file))).toBe(false);
            expect(result.files.some((file) => /migration/i.test(file))).toBe(false);
            expect(await scanTarballForSensitiveValues(result.tarball, [SECRET, repoRoot])).toEqual([]);
          }

          const allowlistOk = await packAllowlistExcludesSensitiveFiles();
          expect(allowlistOk).toBe(true);
        });
      });

      const repoTarballs = [];
      for await (const entry of await readdir(repoRoot)) {
        if (entry.endsWith(".tgz")) {
          repoTarballs.push(entry);
        }
      }
      expect(repoTarballs).toEqual([]);
    },
    300_000,
  );
});
