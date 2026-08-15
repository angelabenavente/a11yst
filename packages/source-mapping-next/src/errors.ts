export class NextSourceValidationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "NextSourceValidationError";
    this.code = code;
  }
}
