import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  writeExternalSarifArtifact,
  writeSarifArtifact,
} from "@a11yst/artifacts";

const tempDirs: string[] = [];
const payload = '{"version":"2.1.0","runs":[]}\n';

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "a11yst-sarif-artifact-"));
  tempDirs.push(dir);
  return dir;
}

describe("writeSarifArtifact", () => {
  it("writes bundle SARIF atomically with trailing newline", async () => {
    const bundle = await tempDir();
    const relativePath = await writeSarifArtifact({
      bundleDirectory: bundle,
      relativePath: "reports/a11yst.sarif",
      serializedSarif: payload,
    });
    expect(relativePath).toBe("reports/a11yst.sarif");
    expect(await readFile(resolve(bundle, "reports/a11yst.sarif"), "utf8")).toBe(payload);
  });

  it("rejects unsafe bundle paths", async () => {
    const bundle = await tempDir();
    await expect(
      writeSarifArtifact({
        bundleDirectory: bundle,
        relativePath: "../escape.sarif",
        serializedSarif: payload,
      }),
    ).rejects.toThrow(/traversal/);
  });

  it("rejects payloads without trailing newline", async () => {
    const bundle = await tempDir();
    await expect(
      writeSarifArtifact({
        bundleDirectory: bundle,
        relativePath: "reports/a11yst.sarif",
        serializedSarif: '{"version":"2.1.0","runs":[]}',
      }),
    ).rejects.toThrow(/trailing newline/);
  });
});

describe("writeExternalSarifArtifact", () => {
  it("creates parent directories and writes atomically", async () => {
    const root = await tempDir();
    const target = join(root, "nested", "a11yst.sarif");
    const written = await writeExternalSarifArtifact({
      targetPath: target,
      serializedSarif: payload,
    });
    expect(written).toBe(resolve(target));
    expect(await readFile(target, "utf8")).toBe(payload);
  });
});
