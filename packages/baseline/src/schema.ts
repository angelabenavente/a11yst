import type { BaselineEntry, BaselineFile } from "@a11yst/types";

export class BaselineValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaselineValidationError";
  }
}

export function validateBaselineFile(input: unknown): BaselineFile {
  if (!input || typeof input !== "object") {
    throw new BaselineValidationError("Baseline file must be a JSON object.");
  }

  const candidate = input as Partial<BaselineFile>;

  if (candidate.schemaVersion !== "1") {
    if (!candidate.schemaVersion) {
      throw new BaselineValidationError(
        "Baseline file is missing schemaVersion. Run `a11yst baseline migrate` if a migration is available.",
      );
    }
    throw new BaselineValidationError(
      `Unsupported baseline schemaVersion "${String(candidate.schemaVersion)}".`,
    );
  }

  if (candidate.fingerprintVersion !== "1") {
    if (!candidate.fingerprintVersion) {
      throw new BaselineValidationError("Baseline file is missing fingerprintVersion.");
    }
    throw new BaselineValidationError(
      `Unsupported fingerprintVersion "${String(candidate.fingerprintVersion)}".`,
    );
  }

  if (!candidate.createdAt || !candidate.updatedAt) {
    throw new BaselineValidationError("Baseline file requires createdAt and updatedAt.");
  }

  if (!Array.isArray(candidate.entries)) {
    throw new BaselineValidationError("Baseline entries must be an array.");
  }

  const seen = new Set<string>();
  for (const entry of candidate.entries) {
    validateBaselineEntry(entry);
    const key = `${entry.fingerprintVersion}:${entry.fingerprint}`;
    if (seen.has(key)) {
      throw new BaselineValidationError(
        `Duplicate baseline entry for fingerprint "${entry.fingerprint}".`,
      );
    }
    seen.add(key);
  }

  return candidate as BaselineFile;
}

function validateBaselineEntry(entry: BaselineEntry): void {
  if (!entry.fingerprint || !entry.ruleId || !entry.projectName) {
    throw new BaselineValidationError("Baseline entry is missing required fields.");
  }
  if (entry.fingerprintVersion !== "1") {
    throw new BaselineValidationError(
      `Unsupported entry fingerprintVersion "${String(entry.fingerprintVersion)}".`,
    );
  }
  if (
    !entry.location ||
    (entry.location.kind !== "route" && entry.location.kind !== "flow-checkpoint")
  ) {
    throw new BaselineValidationError("Baseline entry location is invalid.");
  }
}
