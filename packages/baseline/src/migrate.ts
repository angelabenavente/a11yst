import type { BaselineFile } from "@a11yst/types";
import { validateBaselineFile, BaselineValidationError } from "./schema.js";

export interface MigrateBaselineResult {
  migrated: boolean;
  baseline: BaselineFile;
  message: string;
}

export function migrateBaseline(input: unknown): MigrateBaselineResult {
  if (!input || typeof input !== "object") {
    throw new BaselineValidationError("Baseline file must be a JSON object.");
  }

  const candidate = input as Partial<BaselineFile>;

  if (candidate.schemaVersion === "1") {
    const baseline = validateBaselineFile(input);
    return {
      migrated: false,
      baseline,
      message: "Baseline schema version 1 requires no migration.",
    };
  }

  if (!candidate.schemaVersion) {
    throw new BaselineValidationError(
      "Baseline file is missing schemaVersion. No automatic migration is available.",
    );
  }

  throw new BaselineValidationError(
    `Unsupported baseline schemaVersion "${String(candidate.schemaVersion)}".`,
  );
}
