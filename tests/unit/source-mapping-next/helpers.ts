import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IndexedSourceFile, SourceIndexResult } from "@a11yst/types";
import { createReactSourceCatalog } from "@a11yst/source-mapping-react";
import { createNextRouteCatalog } from "@a11yst/source-mapping-next";

export const FIXTURE_ROOT = resolve(
  fileURLToPath(new URL("../../fixtures/source-mapping-next", import.meta.url)),
);

const UI_EXTENSIONS = new Set([".js", ".jsx", ".tsx"]);

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
      const extension = entry.name.slice(entry.name.lastIndexOf("."));
      const relativePath = relative(root, absolute).replace(/\\/g, "/");
      if (UI_EXTENSIONS.has(extension) || entry.name === "route.ts" || relativePath.includes("/api/")) {
        files.push(relativePath);
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function kindForExtension(extension: string): IndexedSourceFile["kind"] {
  if (extension === ".tsx") {
    return "tsx";
  }
  if (extension === ".jsx") {
    return "jsx";
  }
  if (extension === ".ts") {
    return "typescript";
  }
  return "javascript";
}

function scopeForUri(uri: string): { scopeId: string; projectName: string } {
  if (uri.startsWith("pages-router/")) {
    return { scopeId: "pages-storefront", projectName: "pages-storefront" };
  }
  if (uri.startsWith("hybrid/")) {
    return { scopeId: "hybrid-storefront", projectName: "hybrid-storefront" };
  }
  return { scopeId: "app-storefront", projectName: "app-storefront" };
}

export function fixtureSourceIndex(scopeIds?: string[]): SourceIndexResult {
  const uris = walkFiles(FIXTURE_ROOT, FIXTURE_ROOT);
  const files: IndexedSourceFile[] = uris.map((uri) => {
    const extension = uri.slice(uri.lastIndexOf("."));
    const scope = scopeForUri(uri);
    return {
      uri,
      kind: kindForExtension(extension),
      extension,
      sizeBytes: 1,
      scopeIds: [scope.scopeId],
      projectNames: [scope.projectName],
      frameworks: ["next"],
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

export async function fixtureReactCatalog(scopeIds?: string[]) {
  return createReactSourceCatalog({
    repositoryRoot: FIXTURE_ROOT,
    sourceIndex: fixtureSourceIndex(scopeIds),
    scopeIds,
  });
}

export async function fixtureNextCatalog(scopeIds?: string[]) {
  const reactCatalog = await fixtureReactCatalog(scopeIds);
  return createNextRouteCatalog({
    sourceIndex: fixtureSourceIndex(scopeIds),
    reactCatalog,
    scopeIds,
  });
}
