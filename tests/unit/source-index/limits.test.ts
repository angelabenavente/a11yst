import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { indexRepositorySources } from "@a11yst/source-index";
import { MONOREPO_FIXTURE } from "./helpers.js";

describe("index limits", () => {
  it("marks partial when max files is reached deterministically", async () => {
    const first = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      options: { maxFiles: 3 },
    });
    const second = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      options: { maxFiles: 3 },
    });
    expect(first.status).toBe("partial");
    expect(first.summary.fileLimitReached).toBe(true);
    expect(first.files).toEqual(second.files);
  });

  it("marks partial when max depth is reached", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      scopes: [{ id: "storefront", rootUri: "apps/storefront" }],
      options: { maxDepth: 1 },
    });
    expect(result.status).toBe("partial");
    expect(result.summary.depthLimitReached).toBeGreaterThan(0);
  });

  it("skips oversized files without failing the index", async () => {
    const root = await mkdtemp(join(tmpdir(), "a11yst-source-index-size-"));
    try {
      const content = "a".repeat(3000);
      await writeFile(join(root, "large.ts"), content);
      await writeFile(join(root, "exact.ts"), "a".repeat(2048));
      const result = await indexRepositorySources({
        repositoryRoot: root,
        options: { maxFileSizeBytes: 2048 },
      });
      expect(result.status).toBe("complete");
      expect(result.summary.oversizedFiles).toBe(1);
      expect(result.files.map((file) => file.uri)).toEqual(["exact.ts"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
