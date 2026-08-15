import { SarifGenerationError } from "./errors.js";
import type { SarifLog, SarifResult } from "./types.js";

export function validateGeneratedLog(log: SarifLog): void {
  if (log.version !== "2.1.0") {
    throw new SarifGenerationError(
      `Invalid SARIF version "${log.version}".`,
      "INVALID_VERSION",
    );
  }

  if (log.runs.length === 0) {
    throw new SarifGenerationError("SARIF log must contain at least one run.", "MISSING_RUN");
  }

  const run = log.runs[0]!;
  const driver = run.tool.driver;
  if (!driver.name.trim()) {
    throw new SarifGenerationError("SARIF tool name must not be empty.", "MISSING_TOOL_NAME");
  }
  if (!driver.version.trim()) {
    throw new SarifGenerationError("SARIF tool version must not be empty.", "MISSING_TOOL_VERSION");
  }

  const ruleIds = new Set<string>();
  driver.rules.forEach((rule) => {
    if (ruleIds.has(rule.id)) {
      throw new SarifGenerationError(`Duplicate SARIF rule id "${rule.id}".`, "DUPLICATE_RULE");
    }
    ruleIds.add(rule.id);
  });
  for (let index = 1; index < driver.rules.length; index += 1) {
    const previous = driver.rules[index - 1]!.id;
    const current = driver.rules[index]!.id;
    if (previous.localeCompare(current) > 0) {
      throw new SarifGenerationError("SARIF rules must be sorted by id.", "RULE_ORDER");
    }
  }

  const ruleIndexById = new Map(driver.rules.map((rule, index) => [rule.id, index]));

  let baselineStateCount = 0;
  for (const result of run.results) {
    if (!ruleIndexById.has(result.ruleId)) {
      throw new SarifGenerationError(
        `SARIF result references unknown rule "${result.ruleId}".`,
        "UNKNOWN_RULE",
      );
    }
    if (result.ruleIndex !== ruleIndexById.get(result.ruleId)) {
      throw new SarifGenerationError(
        `SARIF ruleIndex mismatch for rule "${result.ruleId}".`,
        "RULE_INDEX",
      );
    }
    if (!result.message.text.trim()) {
      throw new SarifGenerationError("SARIF result message must not be empty.", "EMPTY_MESSAGE");
    }
    const fingerprintEntries = Object.entries(result.partialFingerprints);
    if (fingerprintEntries.length === 0 || fingerprintEntries.some(([, value]) => !value)) {
      throw new SarifGenerationError("SARIF partial fingerprint must not be empty.", "EMPTY_FINGERPRINT");
    }
    for (const [key] of fingerprintEntries) {
      if (!key.startsWith("a11ystFingerprint/v")) {
        throw new SarifGenerationError(
          `Invalid partial fingerprint key "${key}".`,
          "INVALID_FINGERPRINT_KEY",
        );
      }
    }
    assertNoUndefined(result);
    if (result.baselineState) {
      baselineStateCount += 1;
    }
  }

  if (baselineStateCount > 0 && baselineStateCount !== run.results.length) {
    throw new SarifGenerationError(
      "SARIF baselineState must be present on all results or none.",
      "BASELINE_STATE_MIX",
    );
  }
}

function assertNoUndefined(value: unknown, path = "$"): void {
  if (value === undefined) {
    throw new SarifGenerationError(`Undefined value at ${path}.`, "UNDEFINED_VALUE");
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoUndefined(entry, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assertNoUndefined(entry, `${path}.${key}`);
    }
  }
}

export function sortDiagnostics<T extends { code: string; message: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const byCode = a.code.localeCompare(b.code);
    if (byCode !== 0) return byCode;
    return a.message.localeCompare(b.message);
  });
}

export function hasPrimaryLocationLineHash(result: SarifResult): boolean {
  return Object.prototype.hasOwnProperty.call(result.partialFingerprints, "primaryLocationLineHash");
}
