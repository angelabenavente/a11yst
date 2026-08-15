import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { expect } from "vitest";
import type { SarifLog } from "@a11yst/sarif";

const schemaPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/sarif/sarif-schema-2.1.0.json",
);

let validateFn: Ajv.ValidateFunction | undefined;

export function validateAgainstOfficialSchema(log: SarifLog): void {
  if (!validateFn) {
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;
    const ajv = new Ajv({
      allErrors: true,
      validateSchema: false,
      extendRefs: true,
    });
    validateFn = ajv.compile(schema);
  }

  const valid = validateFn(log);
  if (!valid) {
    const details = (validateFn.errors ?? [])
      .map((error) => `${error.dataPath || error.schemaPath || "/"} ${error.message ?? ""}`)
      .join("\n");
    throw new Error(`SARIF schema validation failed:\n${details}`);
  }
}

export function expectInvalidAgainstSchema(payload: unknown): void {
  if (!validateFn) {
    validateAgainstOfficialSchema({
      $schema:
        "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json",
      version: "2.1.0",
      runs: [],
    });
  }
  expect(validateFn!(payload)).toBe(false);
}
