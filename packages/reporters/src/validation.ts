import { readFile } from "node:fs/promises";
import type { AuditExecutionResult } from "@a11yst/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`Invalid audit result: ${path} must be an object.`);
  }
}

function requireArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Invalid audit result: ${path} must be an array.`);
  }
}

function requireString(value: unknown, path: string): void {
  if (typeof value !== "string") {
    throw new TypeError(`Invalid audit result: ${path} must be a string.`);
  }
}

function requireNumber(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`Invalid audit result: ${path} must be a finite number.`);
  }
}

/**
 * Validates the persisted result boundary used by reporters.
 *
 * The reporter intentionally validates the document structure it consumes,
 * rather than duplicating every configuration contract from @a11yst/types.
 */
export function validateAuditResultDocument(
  value: unknown,
): AuditExecutionResult {
  requireRecord(value, "document");

  if (value.schemaVersion !== "1") {
    const received =
      typeof value.schemaVersion === "string"
        ? `"${value.schemaVersion}"`
        : typeof value.schemaVersion;
    throw new TypeError(
      `Incompatible audit result schemaVersion ${received}; @a11yst/reporters supports only schemaVersion "1".`,
    );
  }

  requireRecord(value.summary, "summary");
  for (const key of [
    "durationMs",
    "plannedRuns",
    "completedRuns",
    "skippedRuns",
    "failedRuns",
    "findingCount",
  ]) {
    requireNumber(value.summary[key], `summary.${key}`);
  }
  requireRecord(value.summary.findingsBySeverity, "summary.findingsBySeverity");
  for (const severity of ["critical", "high", "medium", "minor"]) {
    requireNumber(
      value.summary.findingsBySeverity[severity],
      `summary.findingsBySeverity.${severity}`,
    );
  }

  requireArray(value.runs, "runs");
  value.runs.forEach((run, index) => {
    requireRecord(run, `runs[${index}]`);
    requireString(run.runId, `runs[${index}].runId`);
    requireString(run.status, `runs[${index}].status`);
    requireNumber(run.durationMs, `runs[${index}].durationMs`);
    requireArray(run.findings, `runs[${index}].findings`);
    requireArray(run.diagnostics, `runs[${index}].diagnostics`);
  });

  requireArray(value.findings, "findings");
  value.findings.forEach((finding, index) => {
    requireRecord(finding, `findings[${index}]`);
    for (const key of [
      "id",
      "fingerprint",
      "source",
      "ruleId",
      "title",
      "severity",
      "projectName",
      "profile",
    ]) {
      requireString(finding[key], `findings[${index}].${key}`);
    }
    requireArray(finding.target, `findings[${index}].target`);
    requireArray(finding.standards, `findings[${index}].standards`);
  });

  return value as unknown as AuditExecutionResult;
}

export async function readAuditResult(
  path: string,
): Promise<AuditExecutionResult> {
  let document: unknown;
  try {
    document = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read audit result from "${path}": ${message}`, {
      cause: error,
    });
  }
  return validateAuditResultDocument(document);
}
