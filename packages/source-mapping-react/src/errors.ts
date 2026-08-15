export class ReactSourceValidationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "ReactSourceValidationError";
    this.code = code;
  }
}
