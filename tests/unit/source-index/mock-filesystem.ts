import type { Dirent, Stats } from "node:fs";
import type { SourceIndexFileSystem } from "@a11yst/source-index";

type MockEntry = {
  name: string;
  type: "file" | "directory" | "symlink";
  content?: string;
  size?: number;
  target?: string;
  mode?: number;
};

export class MockSourceIndexFileSystem implements SourceIndexFileSystem {
  readonly files = new Map<string, MockEntry>();
  readonly readLog: string[] = [];
  private readonly canonicalRoot: string;

  constructor(canonicalRoot: string, entries: Record<string, MockEntry>) {
    this.canonicalRoot = canonicalRoot.replace(/\/+$/, "");
    for (const [relativePath, entry] of Object.entries(entries)) {
      this.files.set(this.resolvePath(relativePath), entry);
    }
  }

  resolvePath(relativePath: string): string {
    const normalized = relativePath.replace(/^\/+/, "");
    return normalized ? `${this.canonicalRoot}/${normalized}` : this.canonicalRoot;
  }

  async realpath(_target: string): Promise<string> {
    return this.canonicalRoot;
  }

  async readdir(target: string, _options: { withFileTypes: true }): Promise<Dirent[]> {
    const normalizedTarget = target.replace(/\/+$/, "");
    const prefix = normalizedTarget === this.canonicalRoot ? `${this.canonicalRoot}/` : `${normalizedTarget}/`;
    const childNames = new Set<string>();

    for (const absolutePath of this.files.keys()) {
      if (!absolutePath.startsWith(prefix)) {
        continue;
      }
      const remainder = absolutePath.slice(prefix.length);
      const segment = remainder.split("/")[0];
      if (segment) {
        childNames.add(segment);
      }
    }

    return [...childNames]
      .sort((left, right) => left.localeCompare(right))
      .map((name) => {
        const absolutePath = `${prefix}${name}`;
        const entry = this.files.get(absolutePath);
        const isDirectory =
          entry?.type === "directory" ||
          [...this.files.keys()].some(
            (candidate) => candidate.startsWith(`${absolutePath}/`) && candidate !== absolutePath,
          );

        return {
          name,
          isFile: () => !isDirectory && entry?.type === "file",
          isDirectory: () => isDirectory,
          isSymbolicLink: () => entry?.type === "symlink",
        } as Dirent;
      });
  }

  async lstat(target: string): Promise<Stats> {
    const normalizedTarget = target.replace(/\/+$/, "");
    if (normalizedTarget === this.canonicalRoot) {
      return {
        isFile: () => false,
        isDirectory: () => true,
        isSymbolicLink: () => false,
        size: 0,
        mode: 0o755,
      } as Stats;
    }

    const direct = this.files.get(target);
    if (direct?.type === "symlink") {
      return {
        isFile: () => false,
        isDirectory: () => false,
        isSymbolicLink: () => true,
        size: 0,
        mode: direct.mode ?? 0o755,
      } as Stats;
    }

    if (direct?.type === "file") {
      return {
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
        size: direct.size ?? direct.content?.length ?? 0,
        mode: direct.mode ?? 0o644,
      } as Stats;
    }

    const isDirectory = [...this.files.keys()].some(
      (candidate) => candidate.startsWith(`${target}/`) || candidate === target,
    );
    if (isDirectory) {
      return {
        isFile: () => false,
        isDirectory: () => true,
        isSymbolicLink: () => false,
        size: 0,
        mode: 0o755,
      } as Stats;
    }

    const error = new Error("ENOENT") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    throw error;
  }

  async readFile(target: string, _encoding: "utf8"): Promise<string> {
    this.readLog.push(target);
    const entry = this.files.get(target);
    if (!entry || entry.type !== "file") {
      const error = new Error("ENOENT") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }
    return entry.content ?? "";
  }
}

export function createSimpleMockTree(): {
  filesystem: MockSourceIndexFileSystem;
  root: string;
} {
  const root = "/repo";
  const filesystem = new MockSourceIndexFileSystem(root, {
    ".gitignore": { name: ".gitignore", type: "file", content: "ignored.ts\n" },
    "src/index.ts": { name: "index.ts", type: "file", content: "export {}", size: 10 },
    "src/ignored.ts": { name: "ignored.ts", type: "file", content: "ignored", size: 10 },
    "src/link.ts": { name: "link.ts", type: "symlink", target: "index.ts" },
    "src/app.tsx": { name: "app.tsx", type: "file", content: "<App />", size: 20 },
    "src/pages/home.html": {
      name: "home.html",
      type: "file",
      content: "<html></html>",
      size: 20,
    },
    "src/payment.component.html": {
      name: "payment.component.html",
      type: "file",
      content: "<button></button>",
      size: 20,
    },
    "node_modules/pkg/index.js": {
      name: "index.js",
      type: "file",
      content: "module.exports = {}",
      size: 20,
    },
  });
  return { filesystem, root };
}
