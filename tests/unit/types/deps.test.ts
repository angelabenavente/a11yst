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

  it("keeps adapters depending only on types and static parsers", () => {
    const adapters = readPkg("packages/adapters/package.json");
    expect(adapters.dependencies).toEqual({
      "@a11yst/types": "workspace:*",
      "@babel/parser": "^7.26.3",
      "@babel/types": "^7.26.3",
    });
  });

  it("keeps core planning free of a reverse edge to the CLI", () => {
    const core = readPkg("packages/core/package.json");
    const adapters = readPkg("packages/adapters/package.json");
    expect(core.dependencies?.["@a11yst/adapters"]).toBe("workspace:*");
    expect(core.dependencies?.["@a11yst/types"]).toBe("workspace:*");
    expect(core.dependencies?.["@a11yst/browser"]).toBe("workspace:*");
    expect(core.dependencies?.["@a11yst/cli"]).toBeUndefined();
    expect(adapters.dependencies?.["@a11yst/core"]).toBeUndefined();
    expect(adapters.dependencies?.["@a11yst/cli"]).toBeUndefined();
  });

  it("keeps the browser engine depending on profiles, rules, and Playwright 1.62.0", () => {
    const browser = readPkg("packages/browser/package.json");
    expect(browser.dependencies?.playwright).toBe("1.62.0");
    expect(browser.dependencies?.["playwright-core"]).toBe("1.62.0");
    expect(browser.dependencies?.["@a11yst/profiles"]).toBe("workspace:*");
    expect(browser.dependencies?.["@a11yst/rules"]).toBe("workspace:*");
    expect(browser.dependencies?.["@a11yst/cli"]).toBeUndefined();
  });
});
