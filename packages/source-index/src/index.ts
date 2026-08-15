export type {
  IndexedSourceFile,
  SourceFileKind,
  SourceIndexDiagnostic,
  SourceIndexDiagnosticCode,
  SourceIndexInput,
  SourceIndexOptions,
  SourceIndexResult,
  SourceIndexScope,
  SourceIndexStatus,
  SourceIndexSummary,
} from "@a11yst/types";

export { SourceIndexValidationError } from "./errors.js";
export {
  DEFAULT_IGNORED_DIRECTORY_NAMES,
  DEFAULT_IGNORED_DIRECTORY_PREFIXES,
  GENERATED_FILE_PATTERNS,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  DEFAULT_SCOPE,
} from "./constants.js";
export {
  classifySourceFile,
  extractExtension,
  isGeneratedFile,
  isSupportedSourceExtension,
} from "./classify.js";
export { indexRepositorySources, type IndexRepositorySourcesOptions } from "./index-repository.js";
export type { SourceIndexFileSystem } from "./filesystem.js";
export { createNodeSourceIndexFileSystem, sortDirents } from "./filesystem.js";
export { resolveSourceIndexOptions, validateIgnorePatterns } from "./validate.js";
