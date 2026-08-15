import type {
  SourceMappingSignal,
  SourceMappingSignalKind,
} from "@a11yst/types";
import { isUnsafeAbsolutePath } from "./normalize-uri.js";

export const SIGNAL_KIND_ORDER: readonly SourceMappingSignalKind[] = [
  "accessible-name",
  "attribute",
  "checkpoint",
  "component-name",
  "element-tag",
  "flow",
  "framework-metadata",
  "route",
  "selector",
  "source-location-present",
  "source-map-resolved",
  "visible-text",
];

export const MAX_SIGNAL_VALUE_LENGTH = 256;

const HTML_TAG = /<\/?[a-z][\s\S]*>/i;

const SENSITIVE_PATTERNS: readonly RegExp[] = [
  /\bpassword\s*[:=]/i,
  /\btoken\s*[:=]/i,
  /\bcookie\s*[:=]/i,
  /\bauthorization\s*[:=]/i,
  /\bbearer\s+[a-z0-9._-]+/i,
  /\bstorage[_-]?state\b/i,
  /\bform[_-]?value\s*[:=]/i,
];

export type SanitizeSignalResult = {
  signal: SourceMappingSignal;
  diagnostics: Array<{
    code: "truncated-signal" | "sensitive-value-redacted";
    level: "warning";
    message: string;
  }>;
};

function compareSignalKind(left: SourceMappingSignalKind, right: SourceMappingSignalKind): number {
  return SIGNAL_KIND_ORDER.indexOf(left) - SIGNAL_KIND_ORDER.indexOf(right);
}

export function compareSignals(left: SourceMappingSignal, right: SourceMappingSignal): number {
  const kindOrder = compareSignalKind(left.kind, right.kind);
  if (kindOrder !== 0) {
    return kindOrder;
  }

  const matchedOrder = Number(right.matched) - Number(left.matched);
  if (matchedOrder !== 0) {
    return matchedOrder;
  }

  const leftValue = left.value ?? "";
  const rightValue = right.value ?? "";
  return leftValue.localeCompare(rightValue);
}

export function sortSignals(signals: SourceMappingSignal[]): SourceMappingSignal[] {
  return [...signals].sort(compareSignals);
}

function stripControlCharacters(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0x1f && code !== 0x7f) {
      result += value[index];
    }
  }
  return result;
}

function isSensitiveValue(value: string): boolean {
  if (isUnsafeAbsolutePath(value)) {
    return true;
  }
  if (value.length > MAX_SIGNAL_VALUE_LENGTH && HTML_TAG.test(value)) {
    return true;
  }
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Sanitizes a signal value and returns a safe signal plus optional diagnostics.
 */
export function sanitizeSignal(input: SourceMappingSignal): SanitizeSignalResult {
  const diagnostics: SanitizeSignalResult["diagnostics"] = [];
  const signal: SourceMappingSignal = {
    kind: input.kind,
    matched: input.matched,
  };

  if (input.value === undefined) {
    return { signal, diagnostics };
  }

  let value = stripControlCharacters(String(input.value));

  if (isSensitiveValue(value)) {
    diagnostics.push({
      code: "sensitive-value-redacted",
      level: "warning",
      message: `Signal value for ${input.kind} was redacted`,
    });
    return { signal, diagnostics };
  }

  if (HTML_TAG.test(value)) {
    diagnostics.push({
      code: "truncated-signal",
      level: "warning",
      message: `HTML-like signal value for ${input.kind} was omitted`,
    });
    return { signal, diagnostics };
  }

  if (value.length > MAX_SIGNAL_VALUE_LENGTH) {
    value = value.slice(0, MAX_SIGNAL_VALUE_LENGTH);
    diagnostics.push({
      code: "truncated-signal",
      level: "warning",
      message: `Signal value for ${input.kind} was truncated`,
    });
  }

  signal.value = value;
  return { signal, diagnostics };
}

export function sanitizeSignals(signals: SourceMappingSignal[]): {
  signals: SourceMappingSignal[];
  diagnostics: SanitizeSignalResult["diagnostics"];
} {
  const allDiagnostics: SanitizeSignalResult["diagnostics"] = [];
  const sanitized = signals.map((signal) => {
    const result = sanitizeSignal(signal);
    allDiagnostics.push(...result.diagnostics);
    return result.signal;
  });
  return { signals: sortSignals(sanitized), diagnostics: allDiagnostics };
}

export function mergeSignals(
  left: SourceMappingSignal[],
  right: SourceMappingSignal[],
): SourceMappingSignal[] {
  const merged = new Map<string, SourceMappingSignal>();

  for (const signal of [...left, ...right]) {
    const key = `${signal.kind}\0${signal.matched}\0${signal.value ?? ""}`;
    if (!merged.has(key)) {
      merged.set(key, signal);
    }
  }

  return sortSignals([...merged.values()]);
}
