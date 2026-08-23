#!/usr/bin/env node
import { runPlaywrightCli } from "./playwright-cli.js";

try {
  process.exitCode = await runPlaywrightCli();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
