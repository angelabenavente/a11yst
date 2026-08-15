import fs from "node:fs/promises";
import path from "node:path";
import type { Dirent, Stats } from "node:fs";

export type SourceIndexFileSystem = {
  realpath(target: string): Promise<string>;
  readdir(
    target: string,
    options: { withFileTypes: true },
  ): Promise<Dirent[]>;
  lstat(target: string): Promise<Stats>;
  readFile(target: string, encoding: "utf8"): Promise<string>;
};

export function createNodeSourceIndexFileSystem(): SourceIndexFileSystem {
  return {
    realpath: (target) => fs.realpath(target),
    readdir: (target, options) => fs.readdir(target, options),
    lstat: (target) => fs.lstat(target),
    readFile: (target, encoding) => fs.readFile(target, encoding),
  };
}

export function sortDirents(entries: Dirent[]): Dirent[] {
  return [...entries].sort((left, right) => left.name.localeCompare(right.name));
}

export function isPermissionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EACCES" || error.code === "EPERM")
  );
}

export function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export function isNotDirectoryError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOTDIR";
}

export function joinAbsolute(root: string, ...segments: string[]): string {
  return path.resolve(root, ...segments);
}
