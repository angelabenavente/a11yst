import type {
  IndexedSourceFile,
  SourceIndexDiagnostic,
  SourceIndexResult,
  SourceIndexScope,
  SourceIndexSummary,
} from "@a11yst/types";
import { compareSourceIndexDiagnostics } from "./diagnostics.js";
import type { SourceFileKind } from "@a11yst/types";

export function compareIndexedSourceFiles(
  left: IndexedSourceFile,
  right: IndexedSourceFile,
): number {
  const uriOrder = left.uri.localeCompare(right.uri);
  if (uriOrder !== 0) {
    return uriOrder;
  }
  return left.kind.localeCompare(right.kind);
}

export function sortIndexedSourceFiles(files: IndexedSourceFile[]): IndexedSourceFile[] {
  return [...files].sort(compareIndexedSourceFiles);
}

export function finalizeIndexedFile(file: IndexedSourceFile): IndexedSourceFile {
  const finalized: IndexedSourceFile = {
    uri: file.uri,
    kind: file.kind,
    extension: file.extension,
    sizeBytes: file.sizeBytes,
    scopeIds: [...file.scopeIds].sort((left, right) => left.localeCompare(right)),
  };

  if (file.projectNames !== undefined && file.projectNames.length > 0) {
    finalized.projectNames = [...new Set(file.projectNames)].sort((left, right) =>
      left.localeCompare(right),
    );
  }
  if (file.frameworks !== undefined && file.frameworks.length > 0) {
    finalized.frameworks = [...new Set(file.frameworks)].sort((left, right) =>
      left.localeCompare(right),
    );
  }

  return finalized;
}

export function createEmptySummary(scopeCount: number): SourceIndexSummary {
  return {
    scopes: scopeCount,
    directoriesVisited: 0,
    entriesVisited: 0,
    indexedFiles: 0,
    unsupportedFiles: 0,
    ignoredFiles: 0,
    generatedFiles: 0,
    oversizedFiles: 0,
    symlinksSkipped: 0,
    duplicateFiles: 0,
    permissionErrors: 0,
    depthLimitReached: 0,
    fileLimitReached: false,
  };
}

export function determineStatus(input: {
  fatal: boolean;
  permissionErrors: number;
  gitignoreReadFailed: boolean;
  depthLimitReached: number;
  fileLimitReached: boolean;
  recoverableDirectoryErrors: number;
  scopeDisappeared: boolean;
}): SourceIndexResult["status"] {
  if (input.fatal) {
    return "invalid";
  }
  if (
    input.permissionErrors > 0 ||
    input.gitignoreReadFailed ||
    input.depthLimitReached > 0 ||
    input.fileLimitReached ||
    input.recoverableDirectoryErrors > 0 ||
    input.scopeDisappeared
  ) {
    return "partial";
  }
  return "complete";
}

export function omitUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => omitUndefinedDeep(entry)) as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) {
        result[key] = omitUndefinedDeep(entry);
      }
    }
    return result as T;
  }
  return value;
}

export function buildResult(input: {
  status: SourceIndexResult["status"];
  files: Map<string, IndexedSourceFile>;
  summary: SourceIndexSummary;
  diagnostics: SourceIndexDiagnostic[];
}): SourceIndexResult {
  return omitUndefinedDeep({
    version: 1 as const,
    status: input.status,
    files: sortIndexedSourceFiles([...input.files.values()].map(finalizeIndexedFile)),
    summary: {
      ...input.summary,
      indexedFiles: input.files.size,
    },
    diagnostics: [...input.diagnostics].sort(compareSourceIndexDiagnostics),
  }) as SourceIndexResult;
}

export function mergeScopeMetadata(
  existing: IndexedSourceFile,
  scope: SourceIndexScope,
): IndexedSourceFile {
  const scopeIds = [...existing.scopeIds, scope.id];
  const projectNames = [...(existing.projectNames ?? [])];
  const frameworks = [...(existing.frameworks ?? [])];

  if (scope.projectName !== undefined) {
    projectNames.push(scope.projectName);
  }
  if (scope.framework !== undefined) {
    frameworks.push(scope.framework);
  }

  return finalizeIndexedFile({
    ...existing,
    scopeIds,
    projectNames: projectNames.length > 0 ? projectNames : undefined,
    frameworks: frameworks.length > 0 ? frameworks : undefined,
  });
}

export function kindSortRank(kind: SourceFileKind): number {
  const order: SourceFileKind[] = [
    "angular-template",
    "html",
    "javascript",
    "jsx",
    "typescript",
    "tsx",
    "vue",
    "svelte",
    "astro",
  ];
  return order.indexOf(kind);
}
