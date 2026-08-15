export class SarifGenerationError extends Error {
  readonly code: string;

  constructor(message: string, code = "SARIF_GENERATION_ERROR") {
    super(message);
    this.name = "SarifGenerationError";
    this.code = code;
  }
}
