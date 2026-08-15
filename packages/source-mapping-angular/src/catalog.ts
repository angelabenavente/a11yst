import fs from "node:fs/promises";
import type {
  AngularSourceCatalog,
  AngularSourceCatalogOptions,
  AngularSourceComponent,
  AngularSourceDiagnostic,
  AngularSourceTemplate,
  IndexedSourceFile,
  SourceIndexResult,
} from "@a11yst/types";
import {
  createAngularDiagnostic,
  omitUndefinedDeep,
  sortAngularDiagnostics,
} from "./diagnostics.js";
import { AngularSourceValidationError } from "./errors.js";
import {
  parseComponentMetadataFromSource,
  parseTypeScriptSource,
} from "./parse-component-metadata.js";
import { parseAngularTemplate, type ComponentLookup } from "./parse-angular-template.js";
import { TEMPLATE_INDEX_KIND, TS_INDEX_KIND } from "./constants.js";
import {
  assertAbsoluteRepositoryRoot,
  dirnameUri,
  resolveAngularCatalogOptions,
  resolveIndexedPath,
  resolveTemplateUrl,
  sortStringArray,
} from "./sanitize.js";

export type CreateAngularSourceCatalogInput = {
  repositoryRoot: string;
  sourceIndex: SourceIndexResult;
  scopeIds?: string[];
  options?: AngularSourceCatalogOptions;
  filesystem?: AngularCatalogFileSystem;
};

export type AngularCatalogFileSystem = {
  realpath(path: string): Promise<string>;
  lstat(path: string): Promise<{ isFile(): boolean; isSymbolicLink(): boolean }>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
};

export function createNodeAngularCatalogFileSystem(): AngularCatalogFileSystem {
  return {
    realpath: (target) => fs.realpath(target),
    lstat: (target) => fs.lstat(target),
    readFile: (target, encoding) => fs.readFile(target, encoding),
  };
}

function emptySummary(): AngularSourceCatalog["summary"] {
  return {
    inputTypeScriptFiles: 0,
    inputTemplateFiles: 0,
    parsedTypeScriptFiles: 0,
    parsedTemplateFiles: 0,
    components: 0,
    externalTemplates: 0,
    inlineTemplates: 0,
    componentsWithoutStaticTemplate: 0,
    indexedElements: 0,
    nativeElements: 0,
    componentUsages: 0,
    dynamicBindings: 0,
    eventBindings: 0,
    twoWayBindings: 0,
    structuralDirectives: 0,
    controlFlowBlocks: 0,
    failedTypeScriptFiles: 0,
    failedTemplates: 0,
    unassociatedTemplates: 0,
  };
}

function isTsFile(file: IndexedSourceFile): boolean {
  return file.kind === TS_INDEX_KIND && !file.uri.endsWith(".d.ts");
}

export async function createAngularSourceCatalog(
  input: CreateAngularSourceCatalogInput,
): Promise<AngularSourceCatalog> {
  const filesystem = input.filesystem ?? createNodeAngularCatalogFileSystem();
  const diagnostics: AngularSourceDiagnostic[] = [];

  let options;
  try {
    options = resolveAngularCatalogOptions(input.options);
    assertAbsoluteRepositoryRoot(input.repositoryRoot);
  } catch (error) {
    if (error instanceof AngularSourceValidationError) {
      return omitUndefinedDeep({
        version: 1 as const,
        status: "invalid",
        components: [],
        templates: [],
        diagnostics: [createAngularDiagnostic("invalid-angular-mapping-evidence", "error")],
        summary: emptySummary(),
      }) as AngularSourceCatalog;
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
      components: [],
      templates: [],
      diagnostics: [createAngularDiagnostic("unsafe-angular-source-uri", "error")],
      summary: emptySummary(),
    }) as AngularSourceCatalog;
  }

  const scopeFilter =
    input.scopeIds !== undefined && input.scopeIds.length > 0
      ? new Set(sortStringArray(input.scopeIds))
      : undefined;

  const tsFiles = input.sourceIndex.files
    .filter(isTsFile)
    .filter((file) => !scopeFilter || file.scopeIds.some((id) => scopeFilter.has(id)))
    .sort((a, b) => a.uri.localeCompare(b.uri));

  const templateFiles = input.sourceIndex.files
    .filter((file) => file.kind === TEMPLATE_INDEX_KIND)
    .filter((file) => !scopeFilter || file.scopeIds.some((id) => scopeFilter.has(id)))
    .sort((a, b) => a.uri.localeCompare(b.uri));

  const templateIndex = new Map<string, IndexedSourceFile>();
  for (const file of templateFiles) {
    templateIndex.set(file.uri, file);
  }

  const summary = emptySummary();
  summary.inputTypeScriptFiles = tsFiles.length;
  summary.inputTemplateFiles = templateFiles.length;

  const components: AngularSourceComponent[] = [];
  const templates: AngularSourceTemplate[] = [];
  const associatedTemplateUris = new Set<string>();
  let status: AngularSourceCatalog["status"] = "complete";

  const componentLookup: ComponentLookup = new Map();
  const pendingTemplates: Array<{
    component: AngularSourceComponent;
    metadata: ReturnType<typeof parseComponentMetadataFromSource>[number];
    scopeIds: string[];
    projectNames?: string[];
    sourceFile?: ReturnType<typeof parseTypeScriptSource>;
    sourceText?: string;
  }> = [];

  let tsProcessed = 0;
  for (const indexedFile of tsFiles) {
    if (tsProcessed >= options.maxTypeScriptFiles || components.length >= options.maxComponents) {
      status = "partial";
      diagnostics.push(createAngularDiagnostic("angular-component-limit-reached", "warning"));
      break;
    }
    tsProcessed += 1;

    const absolutePath = resolveIndexedPath(canonicalRoot, indexedFile.uri);
    if (absolutePath === undefined) {
      status = "invalid";
      diagnostics.push(createAngularDiagnostic("unsafe-angular-source-uri", "error", indexedFile.uri));
      continue;
    }

    let lstat;
    try {
      lstat = await filesystem.lstat(absolutePath);
    } catch {
      status = "partial";
      summary.failedTypeScriptFiles += 1;
      diagnostics.push(createAngularDiagnostic("angular-typescript-file-not-found", "warning", indexedFile.uri));
      continue;
    }
    if (lstat.isSymbolicLink() || !lstat.isFile()) {
      status = "partial";
      diagnostics.push(createAngularDiagnostic("angular-typescript-file-not-regular", "warning", indexedFile.uri));
      continue;
    }

    let source: string;
    try {
      source = await filesystem.readFile(absolutePath, "utf8");
    } catch {
      status = "partial";
      summary.failedTypeScriptFiles += 1;
      diagnostics.push(createAngularDiagnostic("angular-typescript-read-failed", "warning", indexedFile.uri));
      continue;
    }

    let sourceFile;
    try {
      sourceFile = parseTypeScriptSource(source, indexedFile.uri);
    } catch {
      status = "partial";
      summary.failedTypeScriptFiles += 1;
      diagnostics.push(createAngularDiagnostic("angular-typescript-parse-failed", "warning", indexedFile.uri));
      continue;
    }

    summary.parsedTypeScriptFiles += 1;
    const parsedComponents = parseComponentMetadataFromSource(sourceFile, indexedFile.uri);
    for (const metadata of parsedComponents) {
      if (components.length >= options.maxComponents) {
        break;
      }
      diagnostics.push(...metadata.diagnostics);

      const component: AngularSourceComponent = {
        sourceUri: indexedFile.uri,
        scopeIds: [...indexedFile.scopeIds],
      };
      if (indexedFile.projectNames) {
        component.projectNames = [...indexedFile.projectNames];
      }
      if (metadata.className) {
        component.className = metadata.className;
      }
      if (metadata.selector) {
        component.selector = metadata.selector;
      }
      if (metadata.elementSelector) {
        component.elementSelector = metadata.elementSelector;
        componentLookup.set(metadata.elementSelector, {
          className: metadata.className,
          componentSelector: metadata.selector,
        });
      }
      if (metadata.templateKind) {
        component.templateKind = metadata.templateKind;
      }
      if (metadata.standalone !== undefined) {
        component.standalone = metadata.standalone;
      }

      if (metadata.templateKind === "external" && metadata.templateUrl) {
        const resolved = resolveTemplateUrl(dirnameUri(indexedFile.uri), metadata.templateUrl);
        if (resolved === undefined) {
          diagnostics.push(createAngularDiagnostic("angular-template-url-unsafe", "warning", indexedFile.uri, metadata.className));
          summary.componentsWithoutStaticTemplate += 1;
        } else if (!templateIndex.has(resolved)) {
          diagnostics.push(createAngularDiagnostic("angular-template-not-indexed", "warning", resolved, metadata.className));
          summary.componentsWithoutStaticTemplate += 1;
        } else {
          component.templateUri = resolved;
          summary.externalTemplates += 1;
        }
      } else if (metadata.templateKind === "inline") {
        component.templateUri = indexedFile.uri;
        summary.inlineTemplates += 1;
      } else {
        summary.componentsWithoutStaticTemplate += 1;
      }

      components.push(component);
      pendingTemplates.push({
        component,
        metadata,
        scopeIds: indexedFile.scopeIds,
        projectNames: indexedFile.projectNames,
        sourceFile,
        sourceText: source,
      });
    }
  }

  summary.components = components.length;

  for (const pending of pendingTemplates) {
    if (templates.length >= options.maxTemplateFiles) {
      status = "partial";
      diagnostics.push(createAngularDiagnostic("angular-template-limit-reached", "warning"));
      break;
    }

    const { component, metadata } = pending;
    if (metadata.templateKind === "inline" && metadata.inlineTemplate) {
      const parsed = parseAngularTemplate(metadata.inlineTemplate, {
        uri: component.sourceUri,
        templateKind: "inline",
        ownerComponent: component.className,
        componentSelector: component.selector,
        scopeIds: pending.scopeIds,
        projectNames: pending.projectNames,
        maxElements: options.maxElementsPerTemplate,
        maxAttributes: options.maxAttributesPerElement,
        maxTextLength: options.maxTextLength,
        inlineTemplateStart: metadata.inlineTemplateStart,
        sourceText: pending.sourceText,
        sourceFile: pending.sourceFile,
        componentLookup,
      });
      diagnostics.push(...parsed.diagnostics);
      summary.parsedTemplateFiles += 1;
      summary.indexedElements += parsed.elements.length;
      summary.nativeElements += parsed.summary.nativeElements;
      summary.componentUsages += parsed.summary.componentUsages;
      summary.dynamicBindings += parsed.summary.dynamicBindings;
      summary.eventBindings += parsed.summary.eventBindings;
      summary.twoWayBindings += parsed.summary.twoWayBindings;
      summary.structuralDirectives += parsed.summary.structuralDirectives;
      summary.controlFlowBlocks += parsed.summary.controlFlowBlocks;
      templates.push({
        templateKind: "inline",
        uri: component.sourceUri,
        ownerSourceUri: component.sourceUri,
        ownerComponent: component.className,
        componentSelector: component.selector,
        elements: parsed.elements,
        scopeIds: [...pending.scopeIds],
        projectNames: pending.projectNames ? [...pending.projectNames] : undefined,
      });
      continue;
    }

    if (metadata.templateKind === "external" && component.templateUri) {
      associatedTemplateUris.add(component.templateUri);
      const absolutePath = resolveIndexedPath(canonicalRoot, component.templateUri);
      if (absolutePath === undefined) {
        continue;
      }
      let templateSource: string;
      try {
        templateSource = await filesystem.readFile(absolutePath, "utf8");
      } catch {
        status = "partial";
        summary.failedTemplates += 1;
        diagnostics.push(createAngularDiagnostic("angular-template-read-failed", "warning", component.templateUri, component.className));
        continue;
      }
      const parsed = parseAngularTemplate(templateSource, {
        uri: component.templateUri,
        templateKind: "external",
        ownerComponent: component.className,
        componentSelector: component.selector,
        scopeIds: pending.scopeIds,
        projectNames: pending.projectNames,
        maxElements: options.maxElementsPerTemplate,
        maxAttributes: options.maxAttributesPerElement,
        maxTextLength: options.maxTextLength,
        componentLookup,
      });
      diagnostics.push(...parsed.diagnostics);
      summary.parsedTemplateFiles += 1;
      summary.indexedElements += parsed.elements.length;
      summary.nativeElements += parsed.summary.nativeElements;
      summary.componentUsages += parsed.summary.componentUsages;
      summary.dynamicBindings += parsed.summary.dynamicBindings;
      summary.eventBindings += parsed.summary.eventBindings;
      summary.twoWayBindings += parsed.summary.twoWayBindings;
      summary.structuralDirectives += parsed.summary.structuralDirectives;
      summary.controlFlowBlocks += parsed.summary.controlFlowBlocks;
      templates.push({
        templateKind: "external",
        uri: component.templateUri,
        ownerSourceUri: component.sourceUri,
        ownerComponent: component.className,
        componentSelector: component.selector,
        elements: parsed.elements,
        scopeIds: [...pending.scopeIds],
        projectNames: pending.projectNames ? [...pending.projectNames] : undefined,
      });
    }
  }

  summary.unassociatedTemplates = templateFiles.filter((file) => !associatedTemplateUris.has(file.uri)).length;

  components.sort((left, right) => {
    const uriDiff = left.sourceUri.localeCompare(right.sourceUri);
    if (uriDiff !== 0) {
      return uriDiff;
    }
    return (left.className ?? "").localeCompare(right.className ?? "");
  });
  templates.sort((left, right) => {
    const uriDiff = left.uri.localeCompare(right.uri);
    if (uriDiff !== 0) {
      return uriDiff;
    }
    return (left.ownerSourceUri).localeCompare(right.ownerSourceUri);
  });

  return omitUndefinedDeep({
    version: 1 as const,
    status,
    components,
    templates,
    diagnostics: sortAngularDiagnostics(diagnostics),
    summary,
  }) as AngularSourceCatalog;
}
