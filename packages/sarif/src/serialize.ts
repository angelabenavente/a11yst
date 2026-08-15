import { SarifGenerationError } from "./errors.js";
import type { SarifLog } from "./types.js";

function stripUndefined(value: unknown, ancestors = new Set<object>()): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefined(entry, ancestors));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (ancestors.has(value)) {
    throw new SarifGenerationError(
      "Cannot serialize circular reference during SARIF cleanup.",
      "CIRCULAR_REFERENCE",
    );
  }
  ancestors.add(value);
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return value;
    }
    const stripped: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) {
        continue;
      }
      stripped[key] = stripUndefined(entry, ancestors);
    }
    return stripped;
  } finally {
    ancestors.delete(value);
  }
}

function normalizeJsonValue(
  value: unknown,
  location: string,
  ancestors: Set<object>,
): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new SarifGenerationError(
        `Cannot serialize non-finite number at ${location}.`,
        "INVALID_NUMBER",
      );
    }
    return value;
  }
  if (
    value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    throw new SarifGenerationError(
      `Cannot serialize ${typeof value} at ${location}.`,
      "INVALID_VALUE",
    );
  }
  if (typeof value !== "object") {
    throw new SarifGenerationError(`Cannot serialize value at ${location}.`, "INVALID_VALUE");
  }
  if (ancestors.has(value)) {
    throw new SarifGenerationError(
      `Cannot serialize circular reference at ${location}.`,
      "CIRCULAR_REFERENCE",
    );
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry, index) =>
        normalizeJsonValue(entry, `${location}[${index}]`, ancestors),
      );
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new SarifGenerationError(
        `Cannot serialize unsupported ${value.constructor?.name ?? "object"} at ${location}.`,
        "INVALID_OBJECT",
      );
    }

    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) {
        continue;
      }
      normalized[key] = normalizeJsonValue(entry, `${location}.${key}`, ancestors);
    }
    return normalized;
  } finally {
    ancestors.delete(value);
  }
}

export function serializeSarif(log: SarifLog): string {
  const cleaned = stripUndefined(log) as SarifLog;
  return `${JSON.stringify(normalizeJsonValue(cleaned, "$", new Set()), null, 2)}\n`;
}
