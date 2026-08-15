import type { SourceRegion } from "@a11yst/types";
import { SourceMappingValidationError } from "./errors.js";

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new SourceMappingValidationError(
      `${label} must be a positive integer`,
      "invalid-source-region",
    );
  }
}

/**
 * Validates and returns a copy of a source region.
 */
export function validateSourceRegion(region: SourceRegion): SourceRegion {
  if (!region || typeof region !== "object") {
    throw new SourceMappingValidationError("region is required", "invalid-source-region");
  }

  const start = region.start;
  if (!start || typeof start !== "object") {
    throw new SourceMappingValidationError("region.start is required", "invalid-source-region");
  }

  const startLine = start.line;
  if (!Number.isFinite(startLine)) {
    throw new SourceMappingValidationError("start line must be finite", "invalid-source-region");
  }
  assertPositiveInteger(startLine, "start line");

  const validated: SourceRegion = {
    start: { line: startLine },
  };

  if (start.column !== undefined) {
    if (!Number.isFinite(start.column)) {
      throw new SourceMappingValidationError("start column must be finite", "invalid-source-region");
    }
    assertPositiveInteger(start.column, "start column");
    validated.start.column = start.column;
  }

  if (region.end !== undefined) {
    const end = region.end;
    if (!end || typeof end !== "object") {
      throw new SourceMappingValidationError("region.end must be an object", "invalid-source-region");
    }

    const endLine = end.line;
    if (!Number.isFinite(endLine)) {
      throw new SourceMappingValidationError("end line must be finite", "invalid-source-region");
    }
    assertPositiveInteger(endLine, "end line");

    if (endLine < startLine) {
      throw new SourceMappingValidationError(
        "end line cannot precede start line",
        "invalid-source-region",
      );
    }

    validated.end = { line: endLine };

    if (end.column !== undefined) {
      if (!Number.isFinite(end.column)) {
        throw new SourceMappingValidationError("end column must be finite", "invalid-source-region");
      }
      assertPositiveInteger(end.column, "end column");

      if (endLine === startLine) {
        const startColumn = validated.start.column ?? 1;
        if (end.column < startColumn) {
          throw new SourceMappingValidationError(
            "end column cannot precede start column on the same line",
            "invalid-source-region",
          );
        }
      }

      validated.end.column = end.column;
    }
  }

  return validated;
}
