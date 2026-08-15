import fs from "node:fs/promises";
import type {
  IndexedSourceFile,
  SourceIndexResult,
  VueSourceCatalog,
  VueSourceCatalogOptions,
  VueSourceDiagnostic,
  VueSourceFile,
} from "@a11yst/types";
import {
  createVueDiagnostic,
  omitUndefinedDeep,
  sortVueDiagnostics,
} from "./diagnostics.js";
import { VueSourceValidationError } from "./errors.js";
import { parseVueSfc } from "./parse-vue-template.js";
import { VUE_INDEX_KIND } from "./constants.js";
import {
  assertAbsoluteRepositoryRoot,
  resolveIndexedVuePath,
  resolveVueCatalogOptions,
  sortStringArray,
} from "./sanitize.js";

export type CreateVueSourceCatalogInput = {
  repositoryRoot: string;
  sourceIndex: SourceIndexResult;
  scopeIds?: string[];
  options?: VueSourceCatalogOptions;
  filesystem?: VueCatalogFileSystem;
};

export type VueCatalogFileSystem = {
  realpath(path: string): Promise<string>;
  lstat(path: string): Promise<{ isFile(): boolean; isSymbolicLink(): boolean }>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
};

export function createNodeVueCatalogFileSystem(): VueCatalogFileSystem {
  return {
    realpath: (target) => fs.realpath(target),
    lstat: (target) => fs.lstat(target),
    readFile: (target, encoding) => fs.readFile(target, encoding),
  };
}

function emptySummary(): VueSourceCatalog["summary"] {
  return {
    inputFiles: 0,
    parsedFiles: 0,
    filesWithoutTemplate: 0,
    unsupportedTemplateLanguages: 0,
    failedFiles: 0,
    indexedElements: 0,
    nativeElements: 0,
    componentUsages: 0,
    dynamicBindings: 0,
    spreadBindings: 0,
    truncatedFiles: 0,
  };
}

function filterVueIndexFiles(
  sourceIndex: SourceIndexResult,
  scopeIds: string[] | undefined,
): { files: IndexedSourceFile[]; diagnostics: VueSourceDiagnostic[] } {
  const vueFiles = sourceIndex.files.filter((file) => file.kind === VUE_INDEX_KIND);
  if (scopeIds === undefined || scopeIds.length === 0) {
    return {
      files: [...vueFiles].sort((left, right) => left.uri.localeCompare(right.uri)),
      diagnostics: [],
    };
  }

  const requestedScopes = sortStringArray(scopeIds);
  const knownScopes = new Set<string>();
  for (const file of vueFiles) {
    for (const scopeId of file.scopeIds) {
      knownScopes.add(scopeId);
    }
  }

  const diagnostics: VueSourceDiagnostic[] = [];
  for (const scopeId of requestedScopes) {
    if (!knownScopes.has(scopeId)) {
      diagnostics.push(createVueDiagnostic("unknown-vue-scope", "warning"));
    }
  }

  const filtered = vueFiles.filter((file) =>
    requestedScopes.some((scopeId) => file.scopeIds.includes(scopeId)),
  );
  return {
    files: filtered.sort((left, right) => left.uri.localeCompare(right.uri)),
    diagnostics,
  };
}

export async function createVueSourceCatalog(
  input: CreateVueSourceCatalogInput,
): Promise<VueSourceCatalog> {
  const filesystem = input.filesystem ?? createNodeVueCatalogFileSystem();
  const diagnostics: VueSourceDiagnostic[] = [];

  let options;
  try {
    options = resolveVueCatalogOptions(input.options);
    assertAbsoluteRepositoryRoot(input.repositoryRoot);
  } catch (error) {
    if (error instanceof VueSourceValidationError) {
      return omitUndefinedDeep({
        version: 1 as const,
        status: "invalid",
        files: [],
        diagnostics: [
          createVueDiagnostic("invalid-vue-mapping-evidence", "error", undefined),
        ],
        summary: emptySummary(),
      }) as VueSourceCatalog;
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
      diagnostics: [createVueDiagnostic("unsafe-vue-source-uri", "error")],
      summary: emptySummary(),
    }) as VueSourceCatalog;
  }

  const filtered = filterVueIndexFiles(input.sourceIndex, input.scopeIds);
  diagnostics.push(...filtered.diagnostics);

  const summary = emptySummary();
  summary.inputFiles = filtered.files.length;

  const catalogFiles: VueSourceFile[] = [];
  let status: VueSourceCatalog["status"] = "complete";
  let filesProcessed = 0;

  for (const indexedFile of filtered.files) {
    if (filesProcessed >= options.maxFiles) {
      status = "partial";
      diagnostics.push(createVueDiagnostic("vue-file-limit-reached", "warning"));
      break;
    }
    filesProcessed += 1;

    const absolutePath = resolveIndexedVuePath(canonicalRoot, indexedFile.uri);
    if (absolutePath === undefined) {
      status = "invalid";
      diagnostics.push(createVueDiagnostic("unsafe-vue-source-uri", "error", indexedFile.uri));
      continue;
    }

    let lstat;
    try {
      lstat = await filesystem.lstat(absolutePath);
    } catch {
      status = "partial";
      diagnostics.push(createVueDiagnostic("vue-file-not-found", "warning", indexedFile.uri));
      continue;
    }

    if (lstat.isSymbolicLink()) {
      status = "partial";
      diagnostics.push(createVueDiagnostic("unsafe-vue-source-uri", "error", indexedFile.uri));
      continue;
    }

    if (!lstat.isFile()) {
      status = "partial";
      diagnostics.push(createVueDiagnostic("vue-file-not-regular", "warning", indexedFile.uri));
      continue;
    }

    let source: string;
    try {
      source = await filesystem.readFile(absolutePath, "utf8");
    } catch {
      status = "partial";
      summary.failedFiles += 1;
      diagnostics.push(createVueDiagnostic("vue-file-read-failed", "warning", indexedFile.uri));
      continue;
    }

    const parsed = parseVueSfc({
      uri: indexedFile.uri,
      source,
      scopeIds: indexedFile.scopeIds,
      projectNames: indexedFile.projectNames,
      maxElementsPerFile: options.maxElementsPerFile,
      maxAttributesPerElement: options.maxAttributesPerElement,
      maxTextLength: options.maxTextLength,
    });

    diagnostics.push(...parsed.diagnostics);
    if (parsed.diagnostics.some((d) => d.code === "vue-template-language-unsupported")) {
      summary.unsupportedTemplateLanguages += 1;
    }
    if (parsed.elements.length === 0 && parsed.diagnostics.some((d) => d.code === "vue-template-missing")) {
      summary.filesWithoutTemplate += 1;
    }

    summary.parsedFiles += 1;
    summary.indexedElements += parsed.elements.length;
    summary.nativeElements += parsed.summary.nativeElements;
    summary.componentUsages += parsed.summary.componentUsages;
    summary.dynamicBindings += parsed.summary.dynamicBindings;
    summary.spreadBindings += parsed.summary.spreadBindings;

    const file: VueSourceFile = {
      uri: indexedFile.uri,
      elements: parsed.elements,
      scopeIds: [...indexedFile.scopeIds],
      hasTemplate: parsed.elements.length > 0 || !parsed.diagnostics.some((d) => d.code === "vue-template-missing"),
    };
    if (indexedFile.projectNames) {
      file.projectNames = [...indexedFile.projectNames];
    }
    catalogFiles.push(file);
  }

  catalogFiles.sort((left, right) => left.uri.localeCompare(right.uri));

  return omitUndefinedDeep({
    version: 1 as const,
    status,
    files: catalogFiles,
    diagnostics: sortVueDiagnostics(diagnostics),
    summary,
  }) as VueSourceCatalog;
}
