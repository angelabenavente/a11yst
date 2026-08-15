import { describe, expect, it } from "vitest";
import { indexRepositorySources } from "@a11yst/source-index";
import { MockSourceIndexFileSystem } from "./mock-filesystem.js";

describe("filesystem errors", () => {
  it("returns invalid for fatal scope errors and partial for recoverable directory errors", async () => {
    const root = "/repo";
    const filesystem = new MockSourceIndexFileSystem(root, {
      "apps/a/src/index.ts": { name: "index.ts", type: "file", content: "export {}", size: 1 },
    });

    const invalid = await indexRepositorySources({
      repositoryRoot: root,
      filesystem,
      scopes: [{ id: "missing", rootUri: "apps/missing" }],
    });
    expect(invalid.status).toBe("invalid");

    filesystem.files.set(`${root}/blocked`, {
      name: "blocked",
      type: "directory",
    });
    filesystem.readdir = async (target) => {
      if (target.endsWith("/blocked")) {
        const error = new Error("EACCES") as NodeJS.ErrnoException;
        error.code = "EACCES";
        throw error;
      }
      return MockSourceIndexFileSystem.prototype.readdir.call(filesystem, target, {
        withFileTypes: true,
      });
    };

    const partial = await indexRepositorySources({
      repositoryRoot: root,
      filesystem,
      scopes: [{ id: "a", rootUri: "apps/a" }],
    });
    expect(partial.status).toBe("complete");

    const partialWithBlocked = await indexRepositorySources({
      repositoryRoot: root,
      filesystem,
      scopes: [{ id: "repo", rootUri: "." }],
    });
    expect(partialWithBlocked.status).toBe("partial");
    expect(partialWithBlocked.summary.permissionErrors).toBeGreaterThan(0);
    expect(JSON.stringify(partialWithBlocked.diagnostics)).not.toContain("stack");
  });
});
