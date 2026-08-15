import type { VueSourceDiagnosticCode } from "@a11yst/types";

export class VueSourceValidationError extends Error {
  readonly code: VueSourceDiagnosticCode;

  constructor(message: string, code: VueSourceDiagnosticCode) {
    super(message);
    this.name = "VueSourceValidationError";
    this.code = code;
  }
}
