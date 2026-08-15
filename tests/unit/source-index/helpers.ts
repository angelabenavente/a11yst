import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

export const MONOREPO_FIXTURE = resolve(
  fileURLToPath(new URL("../../fixtures/source-index/monorepo", import.meta.url)),
);

export function uris(result: { files: Array<{ uri: string }> }): string[] {
  return result.files.map((file) => file.uri);
}

export function expectSorted(values: string[]): void {
  const sorted = [...values].sort((left, right) => left.localeCompare(right));
  expect(values).toEqual(sorted);
}
