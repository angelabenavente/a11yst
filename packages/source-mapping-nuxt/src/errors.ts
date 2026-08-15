import type { NuxtSourceDiagnosticCode } from "@a11yst/types";

export class NuxtSourceValidationError extends Error {
  readonly code: NuxtSourceDiagnosticCode;

  constructor(message: string, code: NuxtSourceDiagnosticCode) {
    super(message);
    this.name = "NuxtSourceValidationError";
    this.code = code;
  }
}
