import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * Resolve Playwright's CLI from this package's dependency, not from a
 * consumer-hoisted binary. pnpm does not expose transitive bins to
 * `pnpm exec`, so `@a11yst/cli` re-exports `playwright` as its own bin.
 */
export function resolvePlaywrightCliPath(): string {
  const require = createRequire(import.meta.url);
  const playwrightEntry = require.resolve("playwright");
  return join(dirname(playwrightEntry), "cli.js");
}

export function runPlaywrightCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [resolvePlaywrightCliPath(), ...argv], {
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
}
