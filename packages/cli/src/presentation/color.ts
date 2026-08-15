import type { TerminalCapabilities } from "./types.js";

export type ColorMode = "auto" | "always" | "never";

/**
 * ANSI color enablement priority (highest wins):
 * 1. Machine output formats (JSON, SARIF, JUnit, etc.) — never ANSI; enforced at call site.
 * 2. `--color never`
 * 3. `NO_COLOR` environment variable
 * 4. `--color always` — ANSI on human terminal text output
 * 5. `--color auto` — ANSI when stdout is an interactive TTY (not dumb, not CI-suppressed)
 */
export function resolveColorEnabled(
  mode: ColorMode,
  capabilities: TerminalCapabilities,
): boolean {
  if (mode === "never") {
    return false;
  }
  if (capabilities.noColor) {
    return false;
  }
  if (mode === "always") {
    return true;
  }
  return capabilities.supportsColor;
}

export function parseColorMode(value: string | undefined): ColorMode {
  if (value === "always" || value === "never") {
    return value;
  }
  return "auto";
}
