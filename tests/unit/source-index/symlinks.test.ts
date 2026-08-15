import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { indexRepositorySources } from "@a11yst/source-index";
import { createSimpleMockTree } from "./mock-filesystem.js";

describe("symlink policy", () => {
  it("skips symlinks via mock filesystem", async () => {
    const { filesystem, root } = createSimpleMockTree();
    const result = await indexRepositorySources({
      repositoryRoot: root,
      filesystem,
    });
    expect(result.summary.symlinksSkipped).toBeGreaterThan(0);
    expect(result.files.some((file) => file.uri === "src/link.ts")).toBe(false);
    const serialized = JSON.stringify(result.diagnostics);
    expect(serialized.includes("/repo/")).toBe(false);
    expect(serialized.includes("index.ts")).toBe(false);
  });

  it("skips real symlinks when the platform supports them", async () => {
    const root = await mkdtemp(join(tmpdir(), "a11yst-source-index-"));
    try {
      await writeFile(join(root, "target.ts"), "export const value = 1;");
      await writeFile(join(root, "page.html"), "<html></html>");
      await mkdir(join(root, "dir-target"), { recursive: true });
      await writeFile(join(root, "dir-target", "inside.ts"), "export {}");

      let symlinkSupported = true;
      try {
        await symlink(join(root, "target.ts"), join(root, "link.ts"));
        await symlink(join(root, "dir-target"), join(root, "link-dir"));
        await symlink("/etc/hosts", join(root, "outside-link.ts"));
        await symlink(join(root, "missing-target.ts"), join(root, "broken-link.ts"));
      } catch {
        symlinkSupported = false;
      }

      if (!symlinkSupported) {
        return;
      }

      const result = await indexRepositorySources({ repositoryRoot: root });
      expect(result.summary.symlinksSkipped).toBeGreaterThan(0);
      expect(result.files.some((file) => file.uri === "link.ts")).toBe(false);
      expect(result.files.some((file) => file.uri === "link-dir/inside.ts")).toBe(false);
      expect(JSON.stringify(result)).not.toContain("/etc/hosts");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
