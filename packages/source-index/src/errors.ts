export class SourceIndexValidationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "SourceIndexValidationError";
    this.code = code;
  }
}
