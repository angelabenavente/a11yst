import type { SarifGenerationDiagnostic } from "./types.js";

export const MAX_RULE_NAME_LENGTH = 255;
export const MAX_SHORT_DESCRIPTION_LENGTH = 1024;
export const MAX_FULL_DESCRIPTION_LENGTH = 4096;
export const MAX_RESULT_MESSAGE_LENGTH = 512;

function isControlCharacter(code: number): boolean {
  return (code >= 0 && code <= 31) || code === 127;
}

export function sanitizeText(value: string): string {
  let sanitized = "";
  for (const char of value) {
    sanitized += isControlCharacter(char.charCodeAt(0)) ? " " : char;
  }
  return sanitized.replace(/\s+/g, " ").trim();
}

export function truncateText(
  value: string,
  maxLength: number,
): { text: string; truncated: boolean } {
  const sanitized = sanitizeText(value);
  if (sanitized.length <= maxLength) {
    return { text: sanitized, truncated: false };
  }
  return { text: `${sanitized.slice(0, maxLength - 1)}…`, truncated: true };
}

export function normalizeRuleName(ruleId: string, preferred?: string): string {
  const base = sanitizeText(preferred ?? deriveRuleName(ruleId));
  if (!base) {
    return ruleId.slice(0, MAX_RULE_NAME_LENGTH);
  }
  return base.length <= MAX_RULE_NAME_LENGTH
    ? base
    : base.slice(0, MAX_RULE_NAME_LENGTH);
}

function deriveRuleName(ruleId: string): string {
  return ruleId
    .split(/[./:_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isValidHelpUri(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidSemanticVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version);
}

export function pushTruncatedDiagnostic(
  diagnostics: SarifGenerationDiagnostic[],
  context: { ruleId?: string; fingerprint?: string },
): void {
  diagnostics.push({
    code: "truncated-text",
    level: "info",
    message: "SARIF text was truncated to remain within deterministic limits.",
    ...(context.ruleId ? { ruleId: context.ruleId } : {}),
    ...(context.fingerprint ? { fingerprint: context.fingerprint } : {}),
  });
}
