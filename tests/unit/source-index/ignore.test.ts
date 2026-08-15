import { describe, expect, it } from "vitest";
import { indexRepositorySources } from "@a11yst/source-index";
import { createSimpleMockTree } from "./mock-filesystem.js";
import { MONOREPO_FIXTURE, uris } from "./helpers.js";

describe("ignore behavior", () => {
  it("respects root .gitignore in the monorepo fixture", async () => {
    const result = await indexRepositorySources({ repositoryRoot: MONOREPO_FIXTURE });
    expect(uris(result)).not.toContain("apps/storefront/src/ignored-by-gitignore.ts");
    expect(uris(result)).toContain("apps/storefront/src/index.ts");
  });

  it("works when .gitignore is absent", async () => {
    const { filesystem, root } = createSimpleMockTree();
    filesystem.files.delete(filesystem.resolvePath(".gitignore"));
    const result = await indexRepositorySources({
      repositoryRoot: root,
      filesystem,
    });
    expect(result.status).toBe("complete");
  });

  it("applies explicit ignore patterns", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      options: {
        ignorePatterns: ["apps/storefront/src/index.ts"],
      },
    });
    expect(uris(result)).not.toContain("apps/storefront/src/index.ts");
  });

  it("rejects absolute ignore patterns", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      options: {
        ignorePatterns: ["/etc/passwd"],
      },
    });
    expect(result.status).toBe("invalid");
  });

  it("rejects null bytes in ignore patterns", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      options: {
        ignorePatterns: ["src\0bad"],
      },
    });
    expect(result.status).toBe("invalid");
  });

  it("does not expose absolute paths in gitignore diagnostics", async () => {
    const { filesystem, root } = createSimpleMockTree();
    filesystem.readFile = async (target, encoding) => {
      if (target.endsWith(".gitignore")) {
        const error = new Error("EACCES") as NodeJS.ErrnoException;
        error.code = "EACCES";
        throw error;
      }
      return createSimpleMockTree().filesystem.readFile.call(filesystem, target, encoding);
    };
    const result = await indexRepositorySources({
      repositoryRoot: root,
      filesystem,
    });
    expect(result.status).toBe("partial");
    expect(JSON.stringify(result.diagnostics).includes(root)).toBe(false);
  });

  it("does not mutate ignore pattern inputs", async () => {
    const patterns = ["apps/storefront/src/components/**"];
    const copy = [...patterns];
    await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      options: { ignorePatterns: patterns },
    });
    expect(patterns).toEqual(copy);
  });
});
