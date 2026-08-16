import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendGitHubStepSummary,
  writeExternalGitHubAnnotationsArtifact,
  writeExternalMarkdownArtifact,
  writeGitHubAnnotationsArtifact,
  writeMarkdownArtifact,
} from "@a11yst/artifacts";

const tempDirs: string[] = [];
const markdownPayload = "# a11yst accessibility report\n\n## Status\n\n| Item | Result |\n| --- | --- |\n| Audit | Completed |\n";
const annotationsPayload = '::error title=a11yst%3A button-name::New serious accessibility finding.::\n';

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

describe("writeGitHubAnnotationsArtifact", () => {
  it("writes bundle GitHub annotations atomically", async () => {
    const bundle = await tempDir();
    const relativePath = await writeGitHubAnnotationsArtifact({
      bundleDirectory: bundle,
      relativePath: "reports/github-annotations.txt",
      serializedCommands: annotationsPayload,
    });
    expect(relativePath).toBe("reports/github-annotations.txt");
    expect(await readFile(resolve(bundle, "reports/github-annotations.txt"), "utf8")).toBe(
      annotationsPayload,
    );
  });

  it("allows empty annotation payloads", async () => {
    const bundle = await tempDir();
    const relativePath = await writeGitHubAnnotationsArtifact({
      bundleDirectory: bundle,
      relativePath: "reports/github-annotations.txt",
      serializedCommands: "",
    });
    expect(relativePath).toBe("reports/github-annotations.txt");
    expect(await readFile(resolve(bundle, "reports/github-annotations.txt"), "utf8")).toBe("");
  });

  it("rejects non-empty payloads without trailing newline", async () => {
    const bundle = await tempDir();
    await expect(
      writeGitHubAnnotationsArtifact({
        bundleDirectory: bundle,
        relativePath: "reports/github-annotations.txt",
        serializedCommands: "::error title=test::message",
      }),
    ).rejects.toThrow(/trailing newline/);
  });
});

describe("writeExternalGitHubAnnotationsArtifact", () => {
  it("creates parent directories and writes atomically", async () => {
    const root = await tempDir();
    const target = join(root, "nested", "github-annotations.txt");
    const written = await writeExternalGitHubAnnotationsArtifact({
      targetPath: target,
      serializedCommands: annotationsPayload,
    });
    expect(written).toBe(resolve(target));
    expect(await readFile(target, "utf8")).toBe(annotationsPayload);
  });
});

describe("appendGitHubStepSummary", () => {
  it("creates the summary file when missing", async () => {
    const root = await tempDir();
    const target = join(root, "step-summary.md");
    await appendGitHubStepSummary(target, markdownPayload);
    expect(await readFile(target, "utf8")).toBe(markdownPayload);
  });

  it("appends with a separating newline when the file already has content", async () => {
    const root = await tempDir();
    const target = join(root, "step-summary.md");
    await writeFile(target, "# Existing summary\n", "utf8");
    await appendGitHubStepSummary(target, markdownPayload);
    expect(await readFile(target, "utf8")).toBe(`# Existing summary\n\n${markdownPayload}`);
  });

  it("adds a trailing newline when markdown is missing one", async () => {
    const root = await tempDir();
    const target = join(root, "step-summary.md");
    await appendGitHubStepSummary(target, "# Summary without newline");
    expect(await readFile(target, "utf8")).toBe("# Summary without newline\n");
  });

  it("rejects empty target paths", async () => {
    await expect(appendGitHubStepSummary("   ", markdownPayload)).rejects.toThrow(
      /must not be empty/,
    );
  });

  it("rejects directory targets", async () => {
    const root = await tempDir();
    await expect(appendGitHubStepSummary(root, markdownPayload)).rejects.toThrow(
      /must point to a file/,
    );
  });
});
