import type { ProgressReporter } from "@a11yst/types";
import type { ColorMode } from "./presentation/color.js";
import { resolveTerminalCapabilities } from "./presentation/capabilities.js";
import { createProgressReporter } from "./presentation/progress-reporter.js";
import {
  resolveProgressModeFromCli,
  type ProgressMode,
} from "./presentation/progress-mode.js";
import { registerProgressSignalHandlers } from "./presentation/progress-signals.js";
import type { TerminalCapabilitiesInput } from "./presentation/types.js";

export interface CliProgressOptions {
  json?: boolean;
  progress?: string;
  noProgress?: boolean;
  colorMode?: ColorMode;
  capabilities?: TerminalCapabilitiesInput;
  stream?: NodeJS.WriteStream;
}

export function createCliProgressReporter(options: CliProgressOptions): ProgressReporter {
  registerProgressSignalHandlers();
  const mode = resolveProgressModeFromCli({
    progress: options.progress,
    noProgress: options.noProgress,
  });
  return createProgressReporter({
    mode,
    machineOutput: Boolean(options.json),
    capabilities: resolveTerminalCapabilities(options.capabilities),
    colorMode: options.colorMode,
    stream: options.stream,
  });
}

export async function withCliProgress<T>(
  progress: ProgressReporter,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  progress.start(label);
  try {
    const result = await fn();
    progress.succeed(label.replace(/…$/, "") || label);
    return result;
  } catch (error) {
    progress.fail(label.replace(/…$/, "") || label);
    throw error;
  } finally {
    progress.stop();
  }
}

export { resolveProgressModeFromCli, type ProgressMode };
