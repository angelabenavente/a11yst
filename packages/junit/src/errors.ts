export class JunitGenerationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "JunitGenerationError";
    this.code = code;
  }
}
