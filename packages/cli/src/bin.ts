#!/usr/bin/env node
import { runCli } from "./index.js";

const code = await runCli();
// Set exitCode (not `process.exit()`) so Node drains buffered stdout/stderr
// writes before the process terminates. Audit `--json` output can exceed a
// single pipe buffer; calling `process.exit()` immediately after a large
// `stream.write()` can truncate it before the OS-level write completes.
process.exitCode = code;
