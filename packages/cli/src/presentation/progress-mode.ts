import type { TerminalCapabilities } from "./types.js";

export type ProgressMode = "auto" | "always" | "never";

export function parseProgressMode(value: string | undefined): ProgressMode {
  if (value === "always" || value === "never") {
    return value;
  }
  return "auto";
}

export interface ResolveProgressEnabledInput {
  mode: ProgressMode;
  machineOutput: boolean;
  capabilities: TerminalCapabilities;
}

/**
 * Whether transient spinner/progress animation should run.
 * Distinct from `--color`: progress may animate without ANSI color.
 */
export function resolveProgressAnimationEnabled(input: ResolveProgressEnabledInput): boolean {
  if (input.mode === "never" || input.machineOutput) {
    return false;
  }
  if (input.mode === "always") {
    return input.capabilities.isStderrTTY && !input.capabilities.isDumbTerminal;
  }
  return (
    input.capabilities.isStderrTTY &&
    !input.capabilities.isCI &&
    !input.capabilities.isDumbTerminal
  );
}

/** Whether static textual milestones may be printed (always mode, non-interactive). */
export function resolveProgressStaticEnabled(input: ResolveProgressEnabledInput): boolean {
  if (input.mode === "never" || input.machineOutput) {
    return false;
  }
  if (input.mode === "always") {
    return !resolveProgressAnimationEnabled(input);
  }
  return false;
}

export function resolveProgressModeFromCli(input: {
  progress?: string;
  noProgress?: boolean;
}): ProgressMode {
  if (input.noProgress) {
    return "never";
  }
  return parseProgressMode(input.progress);
}
