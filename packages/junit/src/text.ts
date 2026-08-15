import type { JunitGenerationDiagnostic } from "./types.js";

export const MAX_SUITE_NAME_LENGTH = 255;
export const MAX_TESTCASE_NAME_LENGTH = 512;
export const MAX_MESSAGE_LENGTH = 1024;
export const MAX_BODY_LENGTH = 4096;

export function truncateText(
  value: string,
  maxLength: number,
): { text: string; truncated: boolean } {
  if (value.length <= maxLength) {
    return { text: value, truncated: false };
  }
  const suffix = "…";
  return {
    text: `${value.slice(0, Math.max(0, maxLength - suffix.length))}${suffix}`,
    truncated: true,
  };
}

export function pushTruncatedDiagnostic(
  diagnostics: JunitGenerationDiagnostic[],
  context: string,
): void {
  diagnostics.push({
    code: "truncated-output",
    level: "info",
    message: `Truncated JUnit text for ${context}.`,
  });
}

export function fingerprintPrefix(fingerprint: string): string {
  return fingerprint.slice(0, 8);
}
