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

  it("keeps detect depending only on types", () => {
    const detect = readPkg("packages/detect/package.json");
    expect(detect.dependencies).toEqual({
      "@a11yst/types": "workspace:*",
    });
    expect(detect.dependencies?.["@a11yst/cli"]).toBeUndefined();
    expect(detect.dependencies?.["@a11yst/config"]).toBeUndefined();
  });

  it("lets the CLI depend on detect without a reverse edge", () => {
    const cli = readPkg("packages/cli/package.json");
    const detect = readPkg("packages/detect/package.json");
    expect(cli.dependencies?.["@a11yst/detect"]).toBe("workspace:*");
    expect(detect.dependencies?.["@a11yst/cli"]).toBeUndefined();
  });
});
