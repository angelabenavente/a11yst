import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IndexedSourceFile, SourceIndexResult } from "@a11yst/types";
import { createVueSourceCatalog } from "@a11yst/source-mapping-vue";
import { createNuxtRouteCatalog } from "@a11yst/source-mapping-nuxt";

export const FIXTURE_ROOT = resolve(
  fileURLToPath(new URL("../../fixtures/source-mapping-nuxt", import.meta.url)),
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
    if (entry.isFile()) {
      files.push(relative(root, absolute).replace(/\\/g, "/"));
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function scopeForUri(uri: string): { scopeId: string; projectName: string } {
  if (uri.startsWith("nuxt3/")) {
    return { scopeId: "nuxt3-store", projectName: "nuxt3-store" };
  }
  if (uri.startsWith("multi-scope/store-a/")) {
    return { scopeId: "store-a", projectName: "store-a" };
  }
  if (uri.startsWith("multi-scope/store-b/")) {
    return { scopeId: "store-b", projectName: "store-b" };
  }
  return { scopeId: "nuxt4-store", projectName: "nuxt4-store" };
}

function kindForFile(uri: string): IndexedSourceFile["kind"] {
  if (uri.endsWith(".vue")) {
    return "vue";
  }
  if (uri.endsWith(".ts")) {
    return "typescript";
  }
  if (uri.endsWith(".tsx")) {
    return "tsx";
  }
  return "javascript";
}

export function fixtureSourceIndex(scopeIds?: string[]): SourceIndexResult {
  const uris = walkFiles(FIXTURE_ROOT, FIXTURE_ROOT);
  const files: IndexedSourceFile[] = uris.map((uri) => {
    const extension = uri.slice(uri.lastIndexOf("."));
    const scope = scopeForUri(uri);
    return {
      uri,
      kind: kindForFile(uri),
      extension,
      sizeBytes: 1,
      scopeIds: [scope.scopeId],
      projectNames: [scope.projectName],
      frameworks: ["nuxt"],
    };
  });

  const filtered =
    scopeIds === undefined
      ? files
      : files.filter((file) => file.scopeIds.some((scopeId) => scopeIds.includes(scopeId)));

  return {
    version: 1,
    status: "complete",
    files: filtered,
    summary: {
      scopes: new Set(filtered.flatMap((file) => file.scopeIds)).size,
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

export async function fixtureVueCatalog(scopeIds?: string[]) {
  return createVueSourceCatalog({
    repositoryRoot: FIXTURE_ROOT,
    sourceIndex: fixtureSourceIndex(scopeIds),
    scopeIds,
  });
}

export async function fixtureNuxtCatalog(scopeIds?: string[]) {
  const vueCatalog = await fixtureVueCatalog(scopeIds);
  return createNuxtRouteCatalog({
    sourceIndex: fixtureSourceIndex(scopeIds),
    vueCatalog,
    scopeIds,
  });
}
