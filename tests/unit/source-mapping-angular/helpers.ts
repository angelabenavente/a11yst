import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IndexedSourceFile, SourceIndexResult } from "@a11yst/types";
import { createAngularSourceCatalog } from "@a11yst/source-mapping-angular";

export const FIXTURE_ROOT = resolve(
  fileURLToPath(new URL("../../fixtures/source-mapping-angular", import.meta.url)),
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
  if (uri.startsWith("scopes/scope-a/")) {
    return { scopeId: "scope-a", projectName: "scope-a" };
  }
  if (uri.startsWith("scopes/scope-b/")) {
    return { scopeId: "scope-b", projectName: "scope-b" };
  }
  return { scopeId: "angular-fixtures", projectName: "angular-fixtures" };
}

function kindForUri(uri: string): IndexedSourceFile["kind"] {
  if (uri.endsWith(".component.html")) {
    return "angular-template";
  }
  return "typescript";
}

export function fixtureSourceIndex(scopeIds?: string[]): SourceIndexResult {
  const uris = walkFiles(FIXTURE_ROOT, FIXTURE_ROOT);
  const files: IndexedSourceFile[] = uris.map((uri) => {
    const extension = uri.slice(uri.lastIndexOf("."));
    const scope = scopeForUri(uri);
    return {
      uri,
      kind: kindForUri(uri),
      extension,
      sizeBytes: 1,
      scopeIds: [scope.scopeId],
      projectNames: [scope.projectName],
      frameworks: ["angular"],
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

export async function fixtureCatalog(scopeIds?: string[]) {
  return createAngularSourceCatalog({
    repositoryRoot: FIXTURE_ROOT,
    sourceIndex: fixtureSourceIndex(scopeIds),
    scopeIds,
  });
}

export function findElement(
  catalog: Awaited<ReturnType<typeof fixtureCatalog>>,
  uri: string,
  predicate: (element: (typeof catalog.templates)[number]["elements"][number]) => boolean,
) {
  for (const template of catalog.templates) {
    if (template.uri !== uri && template.ownerSourceUri !== uri) {
      continue;
    }
    const element = template.elements.find(predicate);
    if (element) {
      return element;
    }
  }
  return undefined;
}
