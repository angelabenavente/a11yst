import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  writeExternalJunitArtifact,
  writeJunitArtifact,
} from "@a11yst/artifacts";

const tempDirs: string[] = [];
const payload = '<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="a11yst" tests="0" failures="0" errors="0" skipped="0" time="0.000">\n</testsuites>\n';

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "a11yst-junit-artifact-"));
  tempDirs.push(dir);
  return dir;
}

describe("writeJunitArtifact", () => {
  it("writes bundle JUnit atomically with trailing newline", async () => {
    const bundle = await tempDir();
    const relativePath = await writeJunitArtifact({
      bundleDirectory: bundle,
      relativePath: "reports/a11yst.junit.xml",
      serializedJunit: payload,
    });
    expect(relativePath).toBe("reports/a11yst.junit.xml");
    expect(await readFile(resolve(bundle, "reports/a11yst.junit.xml"), "utf8")).toBe(payload);
  });

  it("rejects unsafe bundle paths", async () => {
    const bundle = await tempDir();
    await expect(
      writeJunitArtifact({
        bundleDirectory: bundle,
        relativePath: "../escape.junit.xml",
        serializedJunit: payload,
      }),
    ).rejects.toThrow(/traversal/);
  });

  it("rejects payloads without trailing newline", async () => {
    const bundle = await tempDir();
    await expect(
      writeJunitArtifact({
        bundleDirectory: bundle,
        relativePath: "reports/a11yst.junit.xml",
        serializedJunit: '<?xml version="1.0"?><testsuites tests="0" failures="0" errors="0" skipped="0" time="0"/>',
      }),
    ).rejects.toThrow(/trailing newline/);
  });
});

describe("writeExternalJunitArtifact", () => {
  it("creates parent directories and writes atomically", async () => {
    const root = await tempDir();
    const target = join(root, "nested", "a11yst.junit.xml");
    const written = await writeExternalJunitArtifact({
      targetPath: target,
      serializedJunit: payload,
    });
    expect(written).toBe(resolve(target));
    expect(await readFile(target, "utf8")).toBe(payload);
  });
});
