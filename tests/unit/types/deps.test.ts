import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readPkg(relative: string): { name: string; dependencies?: Record<string, string> } {
  return JSON.parse(readFileSync(resolve(root, relative), "utf8")) as {
    name: string;
    dependencies?: Record<string, string>;
  };
}

describe("package dependency graph", () => {
  it("keeps types free of workspace package dependencies", () => {
    const types = readPkg("packages/types/package.json");
    expect(types.dependencies ?? {}).toEqual({});
  });
});
