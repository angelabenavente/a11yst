import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IndexedSourceFile, SourceIndexResult } from "@a11yst/types";
import { createVueSourceCatalog } from "@a11yst/source-mapping-vue";

export const FIXTURE_ROOT = resolve(
  fileURLToPath(new URL("../../fixtures/source-mapping-vue", import.meta.url)),
);

function walkFiles(directory: string, root: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolute, root));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".vue")) {
      files.push(relative(root, absolute).replace(/\\/g, "/"));
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

export function fixtureSourceIndex(scopeIds?: string[]): SourceIndexResult {
  const uris = walkFiles(FIXTURE_ROOT, FIXTURE_ROOT);
  const files: IndexedSourceFile[] = uris.map((uri) => ({
    uri,
    kind: "vue",
    extension: ".vue",
    sizeBytes: 1,
    scopeIds: ["vue-fixtures"],
    projectNames: ["vue-fixtures"],
    frameworks: ["vue"],
  }));

  const filtered =
    scopeIds === undefined
      ? files
      : files.filter((file) => file.scopeIds.some((scopeId) => scopeIds.includes(scopeId)));

  return {
    version: 1,
    status: "complete",
    files: filtered,
    summary: {
      scopes: 1,
      directoriesVisited: 0,
      entriesVisited: 0,
      indexedFiles: filtered.length,
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

export async function fixtureCatalog(scopeIds?: string[]) {
  return createVueSourceCatalog({
    repositoryRoot: FIXTURE_ROOT,
    sourceIndex: fixtureSourceIndex(scopeIds),
    scopeIds,
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
