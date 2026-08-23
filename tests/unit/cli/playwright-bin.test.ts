import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolvePlaywrightCliPath } from "../../../packages/cli/src/playwright-cli.js";

describe("CLI Playwright binary", () => {
  it("resolves Playwright's CLI from the CLI package dependency", () => {
    const cliPath = resolvePlaywrightCliPath();
    expect(cliPath).toMatch(/[/\\]playwright[/\\]cli\.js$/);
    expect(existsSync(cliPath)).toBe(true);
  });
});
