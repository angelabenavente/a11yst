import fs from "node:fs/promises";
import type {
  HtmlSourceCatalog,
  HtmlSourceCatalogOptions,
  HtmlSourceDiagnostic,
  HtmlSourceFile,
  IndexedSourceFile,
  SourceIndexResult,
} from "@a11yst/types";
import * as parse5 from "parse5";
import { createHtmlDiagnostic, omitUndefinedDeep, sortHtmlDiagnostics } from "./diagnostics.js";
import { HtmlSourceValidationError } from "./errors.js";
import { extractHtmlElements, sortHtmlElements } from "./parse-html.js";
import {
  assertAbsoluteRepositoryRoot,
  resolveHtmlCatalogOptions,
  resolveIndexedHtmlPath,
  sortStringArray,
} from "./sanitize.js";

export type CreateHtmlSourceCatalogInput = {
  repositoryRoot: string;
  sourceIndex: SourceIndexResult;
  scopeIds?: string[];
  options?: HtmlSourceCatalogOptions;
  filesystem?: HtmlCatalogFileSystem;
};

export type HtmlCatalogFileSystem = {
  realpath(path: string): Promise<string>;
  lstat(path: string): Promise<{ isFile(): boolean; isSymbolicLink(): boolean }>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
};

export function createNodeHtmlCatalogFileSystem(): HtmlCatalogFileSystem {
  return {
    realpath: (target) => fs.realpath(target),
    lstat: (target) => fs.lstat(target),
    readFile: (target, encoding) => fs.readFile(target, encoding),
  };
}

function filterHtmlIndexFiles(
  sourceIndex: SourceIndexResult,
  scopeIds: string[] | undefined,
): { files: IndexedSourceFile[]; diagnostics: HtmlSourceDiagnostic[] } {
  const htmlFiles = sourceIndex.files.filter((file) => file.kind === "html");
  if (scopeIds === undefined || scopeIds.length === 0) {
    return { files: [...htmlFiles].sort((left, right) => left.uri.localeCompare(right.uri)), diagnostics: [] };
  }

  const requestedScopes = sortStringArray(scopeIds);
  const knownScopes = new Set<string>();
  for (const file of htmlFiles) {
    for (const scopeId of file.scopeIds) {
      knownScopes.add(scopeId);
    }
  }

  const diagnostics: HtmlSourceDiagnostic[] = [];
  for (const scopeId of requestedScopes) {
    if (!knownScopes.has(scopeId)) {
      diagnostics.push(createHtmlDiagnostic("unknown-html-scope", "warning", undefined));
    }
  }

  const filtered = htmlFiles.filter((file) =>
    requestedScopes.some((scopeId) => file.scopeIds.includes(scopeId)),
  );
  return {
    files: filtered.sort((left, right) => left.uri.localeCompare(right.uri)),
    diagnostics,
  };
}

export async function createHtmlSourceCatalog(
  input: CreateHtmlSourceCatalogInput,
): Promise<HtmlSourceCatalog> {
  const filesystem = input.filesystem ?? createNodeHtmlCatalogFileSystem();
  const diagnostics: HtmlSourceDiagnostic[] = [];

  let options;
  try {
    options = resolveHtmlCatalogOptions(input.options);
    assertAbsoluteRepositoryRoot(input.repositoryRoot);
  } catch (error) {
    if (error instanceof HtmlSourceValidationError) {
      return omitUndefinedDeep({
        version: 1 as const,
        status: "invalid",
        files: [],
        diagnostics: [createHtmlDiagnostic("invalid-html-mapping-evidence", "error", error.message)],
        summary: {
          inputFiles: 0,
          parsedFiles: 0,
          failedFiles: 0,
          indexedElements: 0,
          truncatedFiles: 0,
        },
      }) as HtmlSourceCatalog;
    }
    throw error;
  }

  let canonicalRoot: string;
  try {
    canonicalRoot = await filesystem.realpath(input.repositoryRoot);
  } catch {
    return omitUndefinedDeep({
      version: 1 as const,
      status: "invalid",
      files: [],
      diagnostics: [createHtmlDiagnostic("unsafe-html-source-uri", "error")],
      summary: {
        inputFiles: 0,
        parsedFiles: 0,
        failedFiles: 0,
        indexedElements: 0,
        truncatedFiles: 0,
      },
    }) as HtmlSourceCatalog;
  }

  const { files: indexedFiles, diagnostics: scopeDiagnostics } = filterHtmlIndexFiles(
    input.sourceIndex,
    input.scopeIds,
  );
  diagnostics.push(...scopeDiagnostics);

  const catalogFiles: HtmlSourceFile[] = [];
  let parsedFiles = 0;
  let failedFiles = 0;
  let indexedElements = 0;
  let truncatedFiles = 0;
  let fileLimitReached = false;

  for (const indexedFile of indexedFiles) {
    if (fileLimitReached) {
      break;
    }

    const absolutePath = resolveIndexedHtmlPath(canonicalRoot, indexedFile.uri);
    if (absolutePath === undefined) {
      failedFiles += 1;
      diagnostics.push(
        createHtmlDiagnostic("unsafe-html-source-uri", "error", undefined, indexedFile.uri),
      );
      return omitUndefinedDeep({
        version: 1 as const,
        status: "invalid",
        files: [],
        diagnostics: sortHtmlDiagnostics(diagnostics),
        summary: {
          inputFiles: indexedFiles.length,
          parsedFiles,
          failedFiles,
          indexedElements,
          truncatedFiles,
        },
      }) as HtmlSourceCatalog;
    }

    try {
      const stats = await filesystem.lstat(absolutePath);
      if (stats.isSymbolicLink()) {
        failedFiles += 1;
        diagnostics.push(
          createHtmlDiagnostic("html-file-not-regular", "warning", undefined, indexedFile.uri),
        );
        continue;
      }
      if (!stats.isFile()) {
        failedFiles += 1;
        diagnostics.push(
          createHtmlDiagnostic("html-file-not-regular", "warning", undefined, indexedFile.uri),
        );
        continue;
      }
    } catch (error) {
      failedFiles += 1;
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        diagnostics.push(
          createHtmlDiagnostic("html-file-not-found", "warning", undefined, indexedFile.uri),
        );
      } else {
        diagnostics.push(
          createHtmlDiagnostic("html-file-read-failed", "warning", undefined, indexedFile.uri),
        );
      }
      continue;
    }

    let source: string;
    try {
      source = await filesystem.readFile(absolutePath, "utf8");
    } catch (error) {
      failedFiles += 1;
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        diagnostics.push(
          createHtmlDiagnostic("html-file-not-found", "warning", undefined, indexedFile.uri),
        );
      } else {
        diagnostics.push(
          createHtmlDiagnostic("html-file-read-failed", "warning", undefined, indexedFile.uri),
        );
      }
      continue;
    }

    const parseDiagnostics: HtmlSourceDiagnostic[] = [];
    const document = parse5.parse(source, {
      sourceCodeLocationInfo: true,
      onParseError: () => {
        parseDiagnostics.push(
          createHtmlDiagnostic("html-parse-warning", "warning", undefined, indexedFile.uri),
        );
      },
    });

    const extracted = extractHtmlElements({
      uri: indexedFile.uri,
      document,
      scopeIds: indexedFile.scopeIds,
      projectNames: indexedFile.projectNames,
      frameworks: indexedFile.frameworks,
      maxElements: options.maxElementsPerFile,
      maxTextLength: options.maxTextLength,
    });

    diagnostics.push(...parseDiagnostics);
    if (extracted.truncated) {
      truncatedFiles += 1;
      diagnostics.push(
        createHtmlDiagnostic("html-element-limit-reached", "warning", undefined, indexedFile.uri),
      );
    }

    catalogFiles.push({
      uri: indexedFile.uri,
      elements: sortHtmlElements(extracted.elements),
      scopeIds: sortStringArray(indexedFile.scopeIds),
      projectNames:
        indexedFile.projectNames !== undefined
          ? sortStringArray(indexedFile.projectNames)
          : undefined,
      frameworks:
        indexedFile.frameworks !== undefined
          ? sortStringArray(indexedFile.frameworks)
          : undefined,
    });

    parsedFiles += 1;
    indexedElements += extracted.elements.length;

    if (catalogFiles.length >= options.maxFiles) {
      fileLimitReached = true;
      diagnostics.push(createHtmlDiagnostic("html-file-limit-reached", "warning"));
    }
  }

  const status: HtmlSourceCatalog["status"] =
    diagnostics.some((diagnostic) => diagnostic.code === "unsafe-html-source-uri")
      ? "invalid"
      : diagnostics.some(
            (diagnostic) =>
              diagnostic.level !== "info" ||
              diagnostic.code === "html-file-limit-reached" ||
              diagnostic.code === "html-element-limit-reached",
          ) ||
          failedFiles > 0 ||
          fileLimitReached
        ? "partial"
        : "complete";

  return omitUndefinedDeep({
    version: 1 as const,
    status,
    files: catalogFiles.sort((left, right) => left.uri.localeCompare(right.uri)),
    diagnostics: sortHtmlDiagnostics(diagnostics),
    summary: {
      inputFiles: indexedFiles.length,
      parsedFiles,
      failedFiles,
      indexedElements,
      truncatedFiles,
    },
  }) as HtmlSourceCatalog;
}
