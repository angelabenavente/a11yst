import path from "node:path";
import type { Ignore } from "ignore";
import type {
  IndexedSourceFile,
  SourceIndexDiagnostic,
  SourceIndexInput,
  SourceIndexResult,
  SourceIndexScope,
} from "@a11yst/types";
import {
  classifySourceFile,
  extractExtension,
  isGeneratedFile,
} from "./classify.js";
import {
  DEFAULT_IGNORED_DIRECTORY_NAMES,
  DEFAULT_IGNORED_DIRECTORY_PREFIXES,
  DEFAULT_SCOPE,
} from "./constants.js";
import {
  createSourceIndexDiagnostic,
  mergeSourceIndexDiagnostics,
} from "./diagnostics.js";
import { SourceIndexValidationError } from "./errors.js";
import {
  createNodeSourceIndexFileSystem,
  isNotDirectoryError,
  isNotFoundError,
  isPermissionError,
  sortDirents,
  type SourceIndexFileSystem,
} from "./filesystem.js";
import { isIgnoredPath, loadRootGitignore } from "./gitignore.js";
import {
  assertAbsoluteRepositoryRoot,
  resolveScopeAbsolutePath,
  sortScopes,
  toRepositoryUri,
} from "./paths.js";
import {
  buildResult,
  createEmptySummary,
  determineStatus,
  mergeScopeMetadata,
} from "./result.js";
import { resolveSourceIndexOptions } from "./validate.js";

export type IndexRepositorySourcesOptions = SourceIndexInput & {
  filesystem?: SourceIndexFileSystem;
};

type MutableSummary = SourceIndexResult["summary"];

function isSecurityIgnoredDirectory(repositoryRelativeUri: string, entryName: string): boolean {
  if (
    DEFAULT_IGNORED_DIRECTORY_NAMES.includes(
      entryName as (typeof DEFAULT_IGNORED_DIRECTORY_NAMES)[number],
    )
  ) {
    return true;
  }

  return DEFAULT_IGNORED_DIRECTORY_PREFIXES.some(
    (prefix) =>
      repositoryRelativeUri === prefix || repositoryRelativeUri.startsWith(`${prefix}/`),
  );
}

function recordSymlinkSkip(
  state: {
    summary: MutableSummary;
    diagnostics: SourceIndexDiagnostic[];
    symlinkDiagnosticsEmitted: Set<string>;
  },
  uri: string,
  scopeId: string,
): void {
  state.summary.symlinksSkipped += 1;
  if (!state.symlinkDiagnosticsEmitted.has(uri)) {
    state.symlinkDiagnosticsEmitted.add(uri);
    state.diagnostics.push(
      createSourceIndexDiagnostic("symlink-skipped", "info", undefined, {
        uri,
        scopeId,
      }),
    );
  }
}

async function validateRepositoryRoot(
  filesystem: SourceIndexFileSystem,
  repositoryRoot: string,
): Promise<{ canonicalRoot: string } | SourceIndexResult> {
  try {
    assertAbsoluteRepositoryRoot(repositoryRoot);
  } catch (error) {
    if (error instanceof SourceIndexValidationError) {
      return buildResult({
        status: "invalid",
        files: new Map(),
        summary: createEmptySummary(0),
        diagnostics: [
          createSourceIndexDiagnostic("invalid-repository-root", "error", error.message),
        ],
      });
    }
    throw error;
  }

  try {
    const canonicalRoot = await filesystem.realpath(repositoryRoot);
    const stats = await filesystem.lstat(canonicalRoot);
    if (!stats.isDirectory()) {
      return buildResult({
        status: "invalid",
        files: new Map(),
        summary: createEmptySummary(0),
        diagnostics: [
          createSourceIndexDiagnostic("repository-root-not-directory", "error"),
        ],
      });
    }
    return { canonicalRoot };
  } catch (error) {
    if (isNotFoundError(error)) {
      return buildResult({
        status: "invalid",
        files: new Map(),
        summary: createEmptySummary(0),
        diagnostics: [createSourceIndexDiagnostic("repository-root-not-found", "error")],
      });
    }
    throw error;
  }
}

async function validateScopeDirectory(
  filesystem: SourceIndexFileSystem,
  scope: SourceIndexScope,
  scopeAbsolutePath: string,
): Promise<SourceIndexDiagnostic | undefined> {
  try {
    const stats = await filesystem.lstat(scopeAbsolutePath);
    if (stats.isSymbolicLink()) {
      return createSourceIndexDiagnostic("unsafe-scope-root", "error", undefined, {
        scopeId: scope.id,
      });
    }
    if (!stats.isDirectory()) {
      return createSourceIndexDiagnostic("scope-not-directory", "error", undefined, {
        scopeId: scope.id,
        uri: scope.rootUri,
      });
    }
    return undefined;
  } catch (error) {
    if (isNotFoundError(error)) {
      return createSourceIndexDiagnostic("scope-not-found", "error", undefined, {
        scopeId: scope.id,
        uri: scope.rootUri,
      });
    }
    if (isPermissionError(error)) {
      return createSourceIndexDiagnostic("permission-denied", "warning", undefined, {
        scopeId: scope.id,
        uri: scope.rootUri,
      });
    }
    return createSourceIndexDiagnostic("scope-not-found", "error", undefined, {
      scopeId: scope.id,
      uri: scope.rootUri,
    });
  }
}

async function walkScopeDirectory(input: {
  filesystem: SourceIndexFileSystem;
  canonicalRoot: string;
  scope: SourceIndexScope;
  scopeAbsolutePath: string;
  directoryAbsolutePath: string;
  depth: number;
  ignoreMatcher: Ignore;
  options: ReturnType<typeof resolveSourceIndexOptions>;
  files: Map<string, IndexedSourceFile>;
  summary: MutableSummary;
  diagnostics: SourceIndexDiagnostic[];
  symlinkDiagnosticsEmitted: Set<string>;
  duplicateDiagnosticsEmitted: Set<string>;
}): Promise<void> {
  if (input.depth > input.options.maxDepth) {
    return;
  }

  input.summary.directoriesVisited += 1;

  let entries;
  try {
    entries = sortDirents(await input.filesystem.readdir(input.directoryAbsolutePath, {
      withFileTypes: true,
    }));
  } catch (error) {
    if (isPermissionError(error)) {
      input.summary.permissionErrors += 1;
      input.diagnostics.push(
        createSourceIndexDiagnostic("permission-denied", "warning", undefined, {
          scopeId: input.scope.id,
          uri: toRepositoryUri(input.canonicalRoot, input.directoryAbsolutePath),
        }),
      );
      return;
    }
    if (isNotFoundError(error)) {
      input.diagnostics.push(
        createSourceIndexDiagnostic("file-disappeared", "warning", undefined, {
          scopeId: input.scope.id,
        }),
      );
      return;
    }
    if (isNotDirectoryError(error)) {
      input.diagnostics.push(
        createSourceIndexDiagnostic("directory-read-failed", "warning", undefined, {
          scopeId: input.scope.id,
        }),
      );
      return;
    }
    input.diagnostics.push(
      createSourceIndexDiagnostic("directory-read-failed", "warning", undefined, {
        scopeId: input.scope.id,
      }),
    );
    return;
  }

  for (const entry of entries) {
    input.summary.entriesVisited += 1;
    const entryAbsolutePath = path.join(input.directoryAbsolutePath, entry.name);
    const entryUri = toRepositoryUri(input.canonicalRoot, entryAbsolutePath);
    if (entryUri === undefined) {
      continue;
    }

    let entryStats;
    try {
      entryStats = await input.filesystem.lstat(entryAbsolutePath);
    } catch (error) {
      if (isNotFoundError(error)) {
        input.diagnostics.push(
          createSourceIndexDiagnostic("file-disappeared", "warning", undefined, {
            scopeId: input.scope.id,
            uri: entryUri,
          }),
        );
        continue;
      }
      if (isPermissionError(error)) {
        input.summary.permissionErrors += 1;
        input.diagnostics.push(
          createSourceIndexDiagnostic("permission-denied", "warning", undefined, {
            scopeId: input.scope.id,
            uri: entryUri,
          }),
        );
        continue;
      }
      continue;
    }

    if (entryStats.isSymbolicLink()) {
      recordSymlinkSkip(
        {
          summary: input.summary,
          diagnostics: input.diagnostics,
          symlinkDiagnosticsEmitted: input.symlinkDiagnosticsEmitted,
        },
        entryUri,
        input.scope.id,
      );
      continue;
    }

    if (entryStats.isDirectory()) {
      if (isSecurityIgnoredDirectory(entryUri, entry.name)) {
        input.summary.ignoredFiles += 1;
        continue;
      }
      if (isIgnoredPath(input.ignoreMatcher, entryUri.endsWith("/") ? entryUri : `${entryUri}/`)) {
        input.summary.ignoredFiles += 1;
        continue;
      }
      if (isIgnoredPath(input.ignoreMatcher, entryUri)) {
        input.summary.ignoredFiles += 1;
        continue;
      }

      if (input.depth + 1 > input.options.maxDepth) {
        input.summary.depthLimitReached += 1;
        input.diagnostics.push(
          createSourceIndexDiagnostic("depth-limit-reached", "warning", undefined, {
            scopeId: input.scope.id,
            uri: entryUri,
          }),
        );
        continue;
      }

      await walkScopeDirectory({
        ...input,
        directoryAbsolutePath: entryAbsolutePath,
        depth: input.depth + 1,
      });
      continue;
    }

    if (!entryStats.isFile()) {
      continue;
    }

    if (isIgnoredPath(input.ignoreMatcher, entryUri)) {
      input.summary.ignoredFiles += 1;
      continue;
    }

    if (isGeneratedFile(entryUri)) {
      input.summary.generatedFiles += 1;
      continue;
    }

    const kind = classifySourceFile(entryUri);
    if (kind === undefined) {
      input.summary.unsupportedFiles += 1;
      continue;
    }

    if (entryStats.size > input.options.maxFileSizeBytes) {
      input.summary.oversizedFiles += 1;
      continue;
    }

    const existing = input.files.get(entryUri);
    if (existing !== undefined) {
      input.summary.duplicateFiles += 1;
      input.files.set(entryUri, mergeScopeMetadata(existing, input.scope));
      if (!input.duplicateDiagnosticsEmitted.has(entryUri)) {
        input.duplicateDiagnosticsEmitted.add(entryUri);
        input.diagnostics.push(
          createSourceIndexDiagnostic("duplicate-file", "info", undefined, {
            uri: entryUri,
          }),
        );
      }
      continue;
    }

    if (input.summary.fileLimitReached || input.files.size >= input.options.maxFiles) {
      if (!input.summary.fileLimitReached) {
        input.summary.fileLimitReached = true;
        input.diagnostics.push(createSourceIndexDiagnostic("file-limit-reached", "warning"));
      }
      continue;
    }

    const indexed: IndexedSourceFile = {
      uri: entryUri,
      kind,
      extension: extractExtension(entryUri),
      sizeBytes: entryStats.size,
      scopeIds: [input.scope.id],
    };
    if (input.scope.projectName !== undefined) {
      indexed.projectNames = [input.scope.projectName];
    }
    if (input.scope.framework !== undefined) {
      indexed.frameworks = [input.scope.framework];
    }
    input.files.set(entryUri, indexed);
  }
}

export async function indexRepositorySources(
  input: IndexRepositorySourcesOptions,
): Promise<SourceIndexResult> {
  const filesystem = input.filesystem ?? createNodeSourceIndexFileSystem();
  const scopes = sortScopes(
    input.scopes && input.scopes.length > 0 ? input.scopes : [DEFAULT_SCOPE],
  );

  let options: ReturnType<typeof resolveSourceIndexOptions>;
  try {
    options = resolveSourceIndexOptions(input.options);
  } catch (error) {
    if (error instanceof SourceIndexValidationError) {
      return buildResult({
        status: "invalid",
        files: new Map(),
        summary: createEmptySummary(scopes.length),
        diagnostics: [
          createSourceIndexDiagnostic("invalid-repository-root", "error", error.message),
        ],
      });
    }
    throw error;
  }

  const rootValidation = await validateRepositoryRoot(filesystem, input.repositoryRoot);
  if ("status" in rootValidation) {
    return rootValidation;
  }

  const { canonicalRoot } = rootValidation;
  const gitignore = await loadRootGitignore(
    filesystem,
    canonicalRoot,
    options.ignorePatterns,
  );
  const ignoreMatcher = gitignore.matcher;

  const scopeDiagnostics: SourceIndexDiagnostic[] = [];
  for (const scope of scopes) {
    let scopeAbsolutePath: string;
    try {
      scopeAbsolutePath = resolveScopeAbsolutePath(canonicalRoot, scope);
    } catch (error) {
      if (error instanceof SourceIndexValidationError) {
        return buildResult({
          status: "invalid",
          files: new Map(),
          summary: createEmptySummary(scopes.length),
          diagnostics: [
            createSourceIndexDiagnostic("unsafe-scope-root", "error", undefined, {
              scopeId: scope.id,
              uri: scope.rootUri,
            }),
          ],
        });
      }
      throw error;
    }

    if (scope.rootUri !== ".") {
      const scopeUri = toRepositoryUri(canonicalRoot, scopeAbsolutePath);
      if (scopeUri === undefined) {
        return buildResult({
          status: "invalid",
          files: new Map(),
          summary: createEmptySummary(scopes.length),
          diagnostics: [
            createSourceIndexDiagnostic("unsafe-scope-root", "error", undefined, {
              scopeId: scope.id,
              uri: scope.rootUri,
            }),
          ],
        });
      }
    }

    const scopeError = await validateScopeDirectory(filesystem, scope, scopeAbsolutePath);
    if (scopeError !== undefined) {
      scopeDiagnostics.push(scopeError);
      if (scopeError.level === "error") {
        return buildResult({
          status: "invalid",
          files: new Map(),
          summary: createEmptySummary(scopes.length),
          diagnostics: mergeSourceIndexDiagnostics(scopeDiagnostics),
        });
      }
    }
  }

  const fatalScopeErrors = scopeDiagnostics.filter((diagnostic) => diagnostic.level === "error");
  if (fatalScopeErrors.length > 0) {
    return buildResult({
      status: "invalid",
      files: new Map(),
      summary: createEmptySummary(scopes.length),
      diagnostics: mergeSourceIndexDiagnostics(scopeDiagnostics),
    });
  }

  const files = new Map<string, IndexedSourceFile>();
  const summary = createEmptySummary(scopes.length);
  const diagnostics: SourceIndexDiagnostic[] = [...scopeDiagnostics, ...gitignore.diagnostics];
  const symlinkDiagnosticsEmitted = new Set<string>();
  const duplicateDiagnosticsEmitted = new Set<string>();

  for (const scope of scopes) {
    const scopeAbsolutePath = resolveScopeAbsolutePath(canonicalRoot, scope);
    await walkScopeDirectory({
      filesystem,
      canonicalRoot,
      scope,
      scopeAbsolutePath,
      directoryAbsolutePath: scopeAbsolutePath,
      depth: 0,
      ignoreMatcher,
      options,
      files,
      summary,
      diagnostics,
      symlinkDiagnosticsEmitted,
      duplicateDiagnosticsEmitted,
    });
  }

  const status = determineStatus({
    fatal: false,
    permissionErrors: summary.permissionErrors,
    gitignoreReadFailed: gitignore.diagnostics.length > 0,
    depthLimitReached: summary.depthLimitReached,
    fileLimitReached: summary.fileLimitReached,
    recoverableDirectoryErrors: diagnostics.filter(
      (diagnostic) => diagnostic.code === "directory-read-failed",
    ).length,
    scopeDisappeared: diagnostics.some((diagnostic) => diagnostic.code === "file-disappeared"),
  });

  return buildResult({ status, files, summary, diagnostics });
}
