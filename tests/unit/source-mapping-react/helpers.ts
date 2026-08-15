import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IndexedSourceFile, SourceIndexResult } from "@a11yst/types";
import { createReactSourceCatalog } from "@a11yst/source-mapping-react";

export const FIXTURE_ROOT = resolve(
  fileURLToPath(new URL("../../fixtures/source-mapping-react", import.meta.url)),
);

export const FIXTURE_FILES: IndexedSourceFile[] = [
  {
    uri: "CheckoutButton.tsx",
    kind: "tsx",
    extension: ".tsx",
    sizeBytes: 1,
    scopeIds: ["storefront"],
    projectNames: ["storefront"],
  },
  {
    uri: "CheckoutForm.tsx",
    kind: "tsx",
    extension: ".tsx",
    sizeBytes: 1,
    scopeIds: ["storefront"],
    projectNames: ["storefront"],
  },
  {
    uri: "LegacyButton.jsx",
    kind: "jsx",
    extension: ".jsx",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
  {
    uri: "App.js",
    kind: "javascript",
    extension: ".js",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
  {
    uri: "NoJsx.js",
    kind: "javascript",
    extension: ".js",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
  {
    uri: "ComponentUsages.tsx",
    kind: "tsx",
    extension: ".tsx",
    sizeBytes: 1,
    scopeIds: ["storefront"],
  },
  {
    uri: "ClassComponent.tsx",
    kind: "tsx",
    extension: ".tsx",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
  {
    uri: "Malformed.tsx",
    kind: "tsx",
    extension: ".tsx",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
  {
    uri: "Sensitive.tsx",
    kind: "tsx",
    extension: ".tsx",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
  {
    uri: "DuplicateIds.tsx",
    kind: "tsx",
    extension: ".tsx",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
  {
    uri: "ignored.html",
    kind: "html",
    extension: ".html",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
  {
    uri: "ignored.ts",
    kind: "typescript",
    extension: ".ts",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
  {
    uri: "ignored.vue",
    kind: "vue",
    extension: ".vue",
    sizeBytes: 1,
    scopeIds: ["legacy"],
  },
];

const REACT_KINDS = new Set(["jsx", "tsx", "javascript"]);

export function fixtureSourceIndex(): SourceIndexResult {
  const reactFiles = FIXTURE_FILES.filter((file) => REACT_KINDS.has(file.kind));
  return {
    version: 1,
    status: "complete",
    files: reactFiles,
    summary: {
      scopes: 2,
      directoriesVisited: 0,
      entriesVisited: 0,
      indexedFiles: reactFiles.length,
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
  maxPropsPerElement?: number;
  maxTextLength?: number;
}) {
  return createReactSourceCatalog({
    repositoryRoot: FIXTURE_ROOT,
    sourceIndex: fixtureSourceIndex(),
    scopeIds: options?.scopeIds,
    options,
  });
}

export function findElement(
  catalog: Awaited<ReturnType<typeof fixtureCatalog>>,
  uri: string,
  predicate: (element: (typeof catalog.files)[number]["elements"][number]) => boolean,
) {
  const file = catalog.files.find((entry) => entry.uri === uri);
  return file?.elements.find(predicate);
}
