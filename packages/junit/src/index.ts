export type {
  JunitGenerationInput,
  JunitGenerationOptions,
  JunitGenerationResult,
  JunitGenerationDiagnostic,
  JunitGenerationDiagnosticCode,
  JunitTestSuites,
  JunitTestSuite,
  JunitTestCase,
} from "./types.js";
export { JunitGenerationError } from "./errors.js";
export { generateJunit } from "./generate.js";
export { serializeJunit, validateGeneratedDocument } from "./serialize.js";
