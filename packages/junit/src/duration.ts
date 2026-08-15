import type { JunitGenerationDiagnostic } from "./types.js";

export function formatDurationSeconds(
  durationMs: number | undefined,
  diagnostics: JunitGenerationDiagnostic[],
  context: string,
): number {
  if (durationMs === undefined) {
    return 0;
  }
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    diagnostics.push({
      code: "invalid-duration",
      level: "warning",
      message: `Invalid duration for ${context}; using 0 seconds.`,
    });
    return 0;
  }
  return Number((durationMs / 1000).toFixed(3));
}

export function sumDurationSeconds(values: number[]): number {
  return Number(values.reduce((total, value) => total + value, 0).toFixed(3));
}
