import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  writeExternalMarkdownArtifact,
  writeMarkdownArtifact,
} from "@a11yst/artifacts";

const tempDirs: string[] = [];
const markdownPayload = "# a11yst accessibility report\n\n## Status\n\n| Item | Result |\n| --- | --- |\n| Audit | Completed |\n";

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "a11yst-markdown-artifact-"));
  tempDirs.push(dir);
  return dir;
}

describe("writeMarkdownArtifact", () => {
  it("writes bundle Markdown atomically with trailing newline", async () => {
    const bundle = await tempDir();
    const relativePath = await writeMarkdownArtifact({
      bundleDirectory: bundle,
      relativePath: "reports/a11yst.md",
      serializedMarkdown: markdownPayload,
    });
    expect(relativePath).toBe("reports/a11yst.md");
    expect(await readFile(resolve(bundle, "reports/a11yst.md"), "utf8")).toBe(markdownPayload);
  });

  it("rejects unsafe bundle paths", async () => {
    const bundle = await tempDir();
    await expect(
      writeMarkdownArtifact({
        bundleDirectory: bundle,
        relativePath: "../escape.md",
        serializedMarkdown: markdownPayload,
      }),
    ).rejects.toThrow(/traversal/);
  });

  it("rejects payloads without trailing newline", async () => {
    const bundle = await tempDir();
    await expect(
      writeMarkdownArtifact({
        bundleDirectory: bundle,
        relativePath: "reports/a11yst.md",
        serializedMarkdown: "# Missing newline",
      }),
    ).rejects.toThrow(/trailing newline/);
  });
});

describe("writeExternalMarkdownArtifact", () => {
  it("creates parent directories and writes atomically", async () => {
    const root = await tempDir();
    const target = join(root, "nested", "a11yst.md");
    const written = await writeExternalMarkdownArtifact({
      targetPath: target,
      serializedMarkdown: markdownPayload,
    });
    expect(written).toBe(resolve(target));
    expect(await readFile(target, "utf8")).toBe(markdownPayload);
  });
});
