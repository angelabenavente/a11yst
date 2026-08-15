import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IndexedSourceFile, SourceIndexResult } from "@a11yst/types";
import { createHtmlSourceCatalog } from "@a11yst/source-mapping-html";

export const FIXTURE_ROOT = resolve(
  fileURLToPath(new URL("../../fixtures/source-mapping-html", import.meta.url)),
);

export const FIXTURE_FILES: IndexedSourceFile[] = [
  {
    uri: "legacy-checkout.html",
    kind: "html",
    extension: ".html",
    sizeBytes: 1,
    scopeIds: ["legacy"],
    projectNames: ["legacy"],
  },
  {
    uri: "checkout/index.html",
    kind: "html",
    extension: ".html",
    sizeBytes: 1,
    scopeIds: ["storefront"],
    projectNames: ["storefront"],
  },
  {
    uri: "duplicate.html",
    kind: "html",
    extension: ".html",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
  {
    uri: "malformed.html",
    kind: "html",
    extension: ".html",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
  {
    uri: "sensitive.html",
    kind: "html",
    extension: ".html",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
  {
    uri: "ignored.component.html",
    kind: "angular-template",
    extension: ".html",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
  {
    uri: "ignored.tsx",
    kind: "tsx",
    extension: ".tsx",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
];

export function fixtureSourceIndex(): SourceIndexResult {
  return {
    version: 1,
    status: "complete",
    files: FIXTURE_FILES.filter((file) => file.kind === "html"),
    summary: {
      scopes: 1,
      directoriesVisited: 0,
      entriesVisited: 0,
      indexedFiles: FIXTURE_FILES.filter((file) => file.kind === "html").length,
      unsupportedFiles: 0,
      ignoredFiles: 0,
      generatedFiles: 0,
      oversizedFiles: 0,
      symlinksSkipped: 0,
      duplicateFiles: 0,
      permissionErrors: 0,
      depthLimitReached: 0,
      fileLimitReached: false,
    },
    diagnostics: [],
  };
}

export async function fixtureCatalog(options?: {
  scopeIds?: string[];
  maxFiles?: number;
  maxElementsPerFile?: number;
}) {
  return createHtmlSourceCatalog({
    repositoryRoot: FIXTURE_ROOT,
    sourceIndex: fixtureSourceIndex(),
    scopeIds: options?.scopeIds,
    options,
  });
}

export function findElement(
  catalog: Awaited<ReturnType<typeof fixtureCatalog>>,
  uri: string,
  id?: string,
) {
  const file = catalog.files.find((entry) => entry.uri === uri);
  return file?.elements.find((element) => (id ? element.id === id : true));
}
