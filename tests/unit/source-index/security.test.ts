import { describe, expect, it } from "vitest";
import { indexRepositorySources } from "@a11yst/source-index";
import { createSimpleMockTree } from "./mock-filesystem.js";
import { MONOREPO_FIXTURE } from "./helpers.js";

describe("source index security", () => {
  it("redacts sensitive literals from diagnostics and results", async () => {
    const { filesystem, root } = createSimpleMockTree();
    filesystem.files.set(`${root}/secrets/candidate.ts`, {
      name: "candidate.ts",
      type: "file",
      content: "const password = 'SuperSecret';",
      size: 1,
    });

    const result = await indexRepositorySources({
      repositoryRoot: root,
      filesystem,
    });
    const json = JSON.stringify(result);
    expect(json.includes("SuperSecret")).toBe(false);
    expect(json.includes("password =")).toBe(false);
    expect(json.includes(root)).toBe(false);
  });

  it("does not include hostname pid or cwd fields", async () => {
    const result = await indexRepositorySources({ repositoryRoot: MONOREPO_FIXTURE });
    const json = JSON.stringify(result);
    expect(json.includes("hostname")).toBe(false);
    expect(json.includes("pid")).toBe(false);
    expect(json.includes("cwd")).toBe(false);
  });
});

describe("source files are not read", () => {
  it("reads only .gitignore and never source files", async () => {
    const { filesystem, root } = createSimpleMockTree();
    const result = await indexRepositorySources({
      repositoryRoot: root,
      filesystem,
    });
    expect(result.files.length).toBeGreaterThan(0);
    expect(filesystem.readLog.every((path) => path.endsWith(".gitignore"))).toBe(true);
    expect(filesystem.readLog.some((path) => path.endsWith(".tsx"))).toBe(false);
    expect(filesystem.readLog.some((path) => path.endsWith(".vue"))).toBe(false);
    expect(filesystem.readLog.some((path) => path.endsWith(".html"))).toBe(false);
  });
});
