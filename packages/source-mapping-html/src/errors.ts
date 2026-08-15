export class HtmlSourceValidationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "HtmlSourceValidationError";
    this.code = code;
  }
}
