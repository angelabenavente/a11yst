import { describe, expect, it } from "vitest";
import { indexRepositorySources } from "@a11yst/source-index";
import { MONOREPO_FIXTURE } from "./helpers.js";
import { createSimpleMockTree } from "./mock-filesystem.js";

describe("source index determinism", () => {
  it("returns identical results regardless of scope order", async () => {
    const scopes = [
      { id: "b", rootUri: "apps/admin-vue", projectName: "admin", framework: "vue" },
      { id: "a", rootUri: "apps/storefront", projectName: "storefront", framework: "next" },
    ];
    const first = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      scopes,
    });
    const second = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      scopes: [...scopes].reverse(),
    });
    expect(first).toEqual(second);
  });

  it("returns identical results regardless of readdir order", async () => {
    const { filesystem, root } = createSimpleMockTree();
    const originalReaddir = filesystem.readdir.bind(filesystem);
    filesystem.readdir = async (target, options) => {
      const entries = await originalReaddir(target, options);
      return [...entries].reverse();
    };

    const normal = await indexRepositorySources({
      repositoryRoot: root,
      filesystem: createSimpleMockTree().filesystem,
    });
    const reversed = await indexRepositorySources({
      repositoryRoot: root,
      filesystem,
    });
    expect(normal).toEqual(reversed);
  });

  it("does not include timestamps or absolute paths", async () => {
    const result = await indexRepositorySources({ repositoryRoot: MONOREPO_FIXTURE });
    const json = JSON.stringify(result);
    expect(json.includes(MONOREPO_FIXTURE)).toBe(false);
    expect(json.includes("mtime")).toBe(false);
    expect(json.includes("timestamp")).toBe(false);
  });
});
