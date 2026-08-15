import type { TerminalCapabilities, TerminalCapabilitiesInput } from "./types.js";

function readCiFlag(): boolean {
  const ci = process.env.CI;
  return ci !== undefined && ci !== "" && ci !== "0" && ci !== "false";
}

function readNoColorFlag(): boolean {
  return process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "";
}

/** Derive terminal capabilities once at the CLI boundary; inject overrides in tests. */
export function resolveTerminalCapabilities(
  input: TerminalCapabilitiesInput = {},
): TerminalCapabilities {
  const isTTY = input.isTTY ?? Boolean(process.stdout.isTTY);
  const isStderrTTY = input.isStderrTTY ?? Boolean(process.stderr.isTTY);
  const term = input.term ?? process.env.TERM;
  const isCI = input.isCI ?? readCiFlag();
  const noColor = input.noColor ?? readNoColorFlag();
  const isDumbTerminal = term === "dumb";

  return {
    isTTY,
    isStderrTTY,
    isCI,
    isDumbTerminal,
    noColor,
    supportsColor: isTTY && !noColor && !isDumbTerminal,
  };
}
