import type { AngularSourceDiagnosticCode } from "@a11yst/types";

export class AngularSourceValidationError extends Error {
  readonly code: AngularSourceDiagnosticCode;

  constructor(message: string, code: AngularSourceDiagnosticCode) {
    super(message);
    this.name = "AngularSourceValidationError";
    this.code = code;
  }
}
