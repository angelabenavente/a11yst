export class SourceMappingValidationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "SourceMappingValidationError";
    this.code = code;
  }
}
