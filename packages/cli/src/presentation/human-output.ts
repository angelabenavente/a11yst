import { createBrandHeader } from "./brand-header.js";
import { resolveTerminalCapabilities } from "./capabilities.js";
import type { TerminalCapabilities } from "./types.js";

/** Prefix human command output with a brand header. */
export function prependHumanBrandHeader(
  body: string,
  _capabilities: TerminalCapabilities = resolveTerminalCapabilities(),
): string {
  const header = createBrandHeader({ tagline: true });
  return `${header}\n\n${body}`;
}
