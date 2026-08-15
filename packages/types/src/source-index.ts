/**
 * Shared source index contracts for repository file discovery.
 *
 * Implementation lives in `@a11yst/source-index`.
 */

export type SourceFileKind =
  | "html"
  | "angular-template"
  | "javascript"
  | "typescript"
  | "jsx"
  | "tsx"
  | "vue"
  | "svelte"
  | "astro";

export type SourceIndexScope = {
  id: string;
  rootUri: string;
  projectName?: string;
  framework?: string;
};

export type IndexedSourceFile = {
  uri: string;
  kind: SourceFileKind;
  extension: string;
  sizeBytes: number;
  scopeIds: string[];
  projectNames?: string[];
  frameworks?: string[];
};

export type SourceIndexStatus = "complete" | "partial" | "invalid";

export type SourceIndexDiagnosticCode =
  | "invalid-repository-root"
  | "repository-root-not-found"
  | "repository-root-not-directory"
  | "unsafe-scope-root"
  | "scope-not-found"
  | "scope-not-directory"
  | "gitignore-read-failed"
  | "permission-denied"
  | "directory-read-failed"
  | "symlink-skipped"
  | "file-limit-reached"
  | "depth-limit-reached"
  | "duplicate-file"
  | "file-disappeared";

export type SourceIndexDiagnostic = {
  code: SourceIndexDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
  uri?: string;
  scopeId?: string;
};

export type SourceIndexSummary = {
  scopes: number;
  directoriesVisited: number;
  entriesVisited: number;
  indexedFiles: number;
  unsupportedFiles: number;
  ignoredFiles: number;
  generatedFiles: number;
  oversizedFiles: number;
  symlinksSkipped: number;
  duplicateFiles: number;
  permissionErrors: number;
  depthLimitReached: number;
  fileLimitReached: boolean;
};

export type SourceIndexResult = {
  version: 1;
  status: SourceIndexStatus;
  files: IndexedSourceFile[];
  summary: SourceIndexSummary;
  diagnostics: SourceIndexDiagnostic[];
};

export type SourceIndexOptions = {
  ignorePatterns?: string[];
  maxFiles?: number;
  maxDepth?: number;
  maxFileSizeBytes?: number;
};

export type SourceIndexInput = {
  repositoryRoot: string;
  scopes?: SourceIndexScope[];
  options?: SourceIndexOptions;
};
