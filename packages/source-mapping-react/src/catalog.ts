import fs from "node:fs/promises";
import type {
  IndexedSourceFile,
  ReactSourceCatalog,
  ReactSourceCatalogOptions,
  ReactSourceDiagnostic,
  ReactSourceFile,
  SourceIndexResult,
} from "@a11yst/types";
import { createReactDiagnostic, omitUndefinedDeep, sortReactDiagnostics } from "./diagnostics.js";
import { ReactSourceValidationError } from "./errors.js";
import { fileContainsJsx, parseReactSource } from "./parse-react.js";
import { detectModuleBoundary } from "./module-boundary.js";
import { REACT_INDEX_KINDS } from "./constants.js";
import {
  assertAbsoluteRepositoryRoot,
  resolveIndexedReactPath,
  resolveReactCatalogOptions,
  sortStringArray,
} from "./sanitize.js";

export type CreateReactSourceCatalogInput = {
  repositoryRoot: string;
  sourceIndex: SourceIndexResult;
  scopeIds?: string[];
  options?: ReactSourceCatalogOptions;
  filesystem?: ReactCatalogFileSystem;
};

export type ReactCatalogFileSystem = {
  realpath(path: string): Promise<string>;
  lstat(path: string): Promise<{ isFile(): boolean; isSymbolicLink(): boolean }>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
};

export function createNodeReactCatalogFileSystem(): ReactCatalogFileSystem {
  return {
    realpath: (target) => fs.realpath(target),
    lstat: (target) => fs.lstat(target),
    readFile: (target, encoding) => fs.readFile(target, encoding),
  };
}

function filterReactIndexFiles(
  sourceIndex: SourceIndexResult,
  scopeIds: string[] | undefined,
): { files: IndexedSourceFile[]; diagnostics: ReactSourceDiagnostic[] } {
  const reactFiles = sourceIndex.files.filter((file) => REACT_INDEX_KINDS.has(file.kind));
  if (scopeIds === undefined || scopeIds.length === 0) {
    return {
      files: [...reactFiles].sort((left, right) => left.uri.localeCompare(right.uri)),
      diagnostics: [],
    };
  }

  const requestedScopes = sortStringArray(scopeIds);
  const knownScopes = new Set<string>();
  for (const file of reactFiles) {
    for (const scopeId of file.scopeIds) {
      knownScopes.add(scopeId);
    }
  }

  const diagnostics: ReactSourceDiagnostic[] = [];
  for (const scopeId of requestedScopes) {
    if (!knownScopes.has(scopeId)) {
      diagnostics.push(createReactDiagnostic("unknown-react-scope", "warning"));
    }
  }

  const filtered = reactFiles.filter((file) =>
    requestedScopes.some((scopeId) => file.scopeIds.includes(scopeId)),
  );
  return {
    files: filtered.sort((left, right) => left.uri.localeCompare(right.uri)),
    diagnostics,
  };
}

export async function createReactSourceCatalog(
  input: CreateReactSourceCatalogInput,
): Promise<ReactSourceCatalog> {
  const filesystem = input.filesystem ?? createNodeReactCatalogFileSystem();
  const diagnostics: ReactSourceDiagnostic[] = [];

  let options;
  try {
    options = resolveReactCatalogOptions(input.options);
    assertAbsoluteRepositoryRoot(input.repositoryRoot);
  } catch (error) {
    if (error instanceof ReactSourceValidationError) {
      return omitUndefinedDeep({
        version: 1 as const,
        status: "invalid",
        files: [],
        diagnostics: [
          createReactDiagnostic("invalid-react-mapping-evidence", "error", error.message),
        ],
        summary: emptySummary(),
      }) as ReactSourceCatalog;
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
      diagnostics: [createReactDiagnostic("unsafe-react-source-uri", "error")],
      summary: emptySummary(),
    }) as ReactSourceCatalog;
  }

  const { files: indexedFiles, diagnostics: scopeDiagnostics } = filterReactIndexFiles(
    input.sourceIndex,
    input.scopeIds,
  );
  diagnostics.push(...scopeDiagnostics);

  const catalogFiles: ReactSourceFile[] = [];
  let parsedFiles = 0;
  let failedFiles = 0;
  let filesWithoutJsx = 0;
  let indexedElements = 0;
  let intrinsicElements = 0;
  let componentUsages = 0;
  let dynamicProps = 0;
  let spreadProps = 0;
  let truncatedFiles = 0;
  let fileLimitReached = false;

  for (const indexedFile of indexedFiles) {
    if (fileLimitReached) {
      break;
    }

    const absolutePath = resolveIndexedReactPath(canonicalRoot, indexedFile.uri);
    if (absolutePath === undefined) {
      failedFiles += 1;
      diagnostics.push(
        createReactDiagnostic("unsafe-react-source-uri", "error", undefined, indexedFile.uri),
      );
      return omitUndefinedDeep({
        version: 1 as const,
        status: "invalid",
        files: [],
        diagnostics: sortReactDiagnostics(diagnostics),
        summary: {
          inputFiles: indexedFiles.length,
          parsedFiles,
          filesWithoutJsx,
          failedFiles,
          indexedElements,
          intrinsicElements,
          componentUsages,
          dynamicProps,
          spreadProps,
          truncatedFiles,
        },
      }) as ReactSourceCatalog;
    }

    try {
      const stats = await filesystem.lstat(absolutePath);
      if (stats.isSymbolicLink()) {
        failedFiles += 1;
        diagnostics.push(
          createReactDiagnostic("react-file-not-regular", "warning", undefined, indexedFile.uri),
        );
        continue;
      }
      if (!stats.isFile()) {
        failedFiles += 1;
        diagnostics.push(
          createReactDiagnostic("react-file-not-regular", "warning", undefined, indexedFile.uri),
        );
        continue;
      }
    } catch (error) {
      failedFiles += 1;
      if (isEnoent(error)) {
        diagnostics.push(
          createReactDiagnostic("react-file-not-found", "warning", undefined, indexedFile.uri),
        );
      } else {
        diagnostics.push(
          createReactDiagnostic("react-file-read-failed", "warning", undefined, indexedFile.uri),
        );
      }
      continue;
    }

    let source: string;
    try {
      source = await filesystem.readFile(absolutePath, "utf8");
    } catch (error) {
      failedFiles += 1;
      if (isEnoent(error)) {
        diagnostics.push(
          createReactDiagnostic("react-file-not-found", "warning", undefined, indexedFile.uri),
        );
      } else {
        diagnostics.push(
          createReactDiagnostic("react-file-read-failed", "warning", undefined, indexedFile.uri),
        );
      }
      continue;
    }

    if (indexedFile.kind === "javascript" && !fileContainsJsx(source, indexedFile.uri)) {
      filesWithoutJsx += 1;
      diagnostics.push(
        createReactDiagnostic("react-file-without-jsx", "info", undefined, indexedFile.uri),
      );
      catalogFiles.push(createEmptyReactFile(indexedFile));
      parsedFiles += 1;
      continue;
    }

    const parsed = parseReactSource({
      uri: indexedFile.uri,
      source,
      scopeIds: indexedFile.scopeIds,
      projectNames: indexedFile.projectNames,
      frameworks: indexedFile.frameworks,
      options: {
        maxElementsPerFile: options.maxElementsPerFile,
        maxPropsPerElement: options.maxPropsPerElement,
        maxTextLength: options.maxTextLength,
      },
    });

    if (parsed.parseFailed) {
      failedFiles += 1;
      diagnostics.push(
        createReactDiagnostic("react-parse-failed", "warning", undefined, indexedFile.uri),
      );
      continue;
    }

    if (parsed.parseWarning) {
      diagnostics.push(
        createReactDiagnostic("react-parse-warning", "warning", undefined, indexedFile.uri),
      );
    }

    if (parsed.spreadDiagnostics > 0) {
      diagnostics.push(createReactDiagnostic("react-spread-props", "info", undefined, indexedFile.uri));
    }
    if (parsed.dynamicDiagnostics > 0) {
      diagnostics.push(createReactDiagnostic("react-dynamic-prop", "info", undefined, indexedFile.uri));
    }
    if (parsed.fragmentIgnored > 0) {
      diagnostics.push(
        createReactDiagnostic("react-fragment-ignored", "info", undefined, indexedFile.uri),
      );
    }
    if (parsed.truncatedText) {
      diagnostics.push(
        createReactDiagnostic("react-text-truncated", "info", undefined, indexedFile.uri),
      );
    }
    if (parsed.truncatedElements) {
      truncatedFiles += 1;
      diagnostics.push(
        createReactDiagnostic("react-element-limit-reached", "warning", undefined, indexedFile.uri),
      );
    }
    if (parsed.truncatedProps) {
      diagnostics.push(
        createReactDiagnostic("react-prop-limit-reached", "warning", undefined, indexedFile.uri),
      );
    }

    catalogFiles.push({
      uri: indexedFile.uri,
      elements: parsed.elements,
      scopeIds: sortStringArray(indexedFile.scopeIds),
      projectNames:
        indexedFile.projectNames !== undefined
          ? sortStringArray(indexedFile.projectNames)
          : undefined,
      frameworks:
        indexedFile.frameworks !== undefined
          ? sortStringArray(indexedFile.frameworks)
          : undefined,
      hasJsx: parsed.hasJsx,
      moduleBoundary: detectModuleBoundary(indexedFile.uri, source),
    });

    parsedFiles += 1;
    indexedElements += parsed.elements.length;
    intrinsicElements += parsed.intrinsicElements;
    componentUsages += parsed.componentUsages;
    dynamicProps += parsed.dynamicProps;
    spreadProps += parsed.spreadProps;

    if (catalogFiles.length >= options.maxFiles) {
      fileLimitReached = true;
      diagnostics.push(createReactDiagnostic("react-file-limit-reached", "warning"));
    }
  }

  const status: ReactSourceCatalog["status"] = diagnostics.some(
    (diagnostic) => diagnostic.code === "unsafe-react-source-uri",
  )
    ? "invalid"
    : diagnostics.some(
          (diagnostic) =>
            diagnostic.level !== "info" ||
            diagnostic.code === "react-file-limit-reached" ||
            diagnostic.code === "react-element-limit-reached",
        ) ||
        failedFiles > 0 ||
        fileLimitReached
      ? "partial"
      : "complete";

  return omitUndefinedDeep({
    version: 1 as const,
    status,
    files: catalogFiles.sort((left, right) => left.uri.localeCompare(right.uri)),
    diagnostics: sortReactDiagnostics(diagnostics),
    summary: {
      inputFiles: indexedFiles.length,
      parsedFiles,
      filesWithoutJsx,
      failedFiles,
      indexedElements,
      intrinsicElements,
      componentUsages,
      dynamicProps,
      spreadProps,
      truncatedFiles,
    },
  }) as ReactSourceCatalog;
}

function createEmptyReactFile(indexedFile: IndexedSourceFile): ReactSourceFile {
  return {
    uri: indexedFile.uri,
    elements: [],
    scopeIds: sortStringArray(indexedFile.scopeIds),
    projectNames:
      indexedFile.projectNames !== undefined
        ? sortStringArray(indexedFile.projectNames)
        : undefined,
    frameworks:
      indexedFile.frameworks !== undefined
        ? sortStringArray(indexedFile.frameworks)
        : undefined,
    hasJsx: false,
  };
}

function emptySummary(): ReactSourceCatalog["summary"] {
  return {
    inputFiles: 0,
    parsedFiles: 0,
    filesWithoutJsx: 0,
    failedFiles: 0,
    indexedElements: 0,
    intrinsicElements: 0,
    componentUsages: 0,
    dynamicProps: 0,
    spreadProps: 0,
    truncatedFiles: 0,
  };
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
