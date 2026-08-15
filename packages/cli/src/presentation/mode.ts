import type { TerminalCapabilities, TerminalPresentationMode } from "./types.js";

/** Conservative interactive detection: TTY, not CI, not a dumb terminal. */
export function resolveTerminalPresentationMode(
  capabilities: TerminalCapabilities,
): TerminalPresentationMode {
  if (!capabilities.isTTY || capabilities.isCI || capabilities.isDumbTerminal) {
    return "plain";
  }
  return "interactive";
}
