import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, relative } from "node:path";
import type { LoadedWorkspacePackage } from "./workspace-packages.js";
import { getRepoRoot, isWorkspaceDependencyRange } from "./workspace-packages.js";

export type PackagePackResult = {
  packageName: string;
  version: string;
  tarball: string;
  fileCount: number;
  sizeBytes: number;
  manifest: Record<string, unknown>;
  files: string[];
  requiredFiles: string[];
  unexpectedFiles: string[];
};

const FORBIDDEN_PREFIXES = [
  "package/src/",
  "package/tests/",
  "package/test/",
  "package/coverage/",
  "package/node_modules/",
  "package/examples/",
  "package/.git/",
  "package/.github/",
  "package/pnpm-lock.yaml",
];

const FORBIDDEN_EXACT = ["package/.env"];

function assertTarAvailable(): void {
  const result = spawnSync("tar", ["--version"], { encoding: "utf8", shell: false });
  if (result.error || result.status !== 0) {
    throw new Error("Build packages before running packaging integration tests: tar utility unavailable.");
  }
}

function expectedTarballPath(
  destination: string,
  manifest: { name: string; version: string },
): string {
  const baseName = manifest.name.startsWith("@")
    ? manifest.name.slice(1).replace("/", "-")
    : manifest.name.replace("/", "-");
  return join(destination, `${baseName}-${manifest.version}.tgz`);
}

export async function packPackage(
  pkg: LoadedWorkspacePackage,
  destination: string,
): Promise<PackagePackResult> {
  const result = spawnSync(
    "pnpm",
    ["pack", "--pack-destination", destination],
    {
      cwd: pkg.dirAbsolute,
      encoding: "utf8",
      shell: false,
      env: { ...process.env, NO_COLOR: "1" },
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `pnpm pack failed for ${pkg.manifest.name}: ${result.stderr || result.stdout || "unknown error"}`,
    );
  }

  const tarball = expectedTarballPath(destination, pkg.manifest);
  try {
    await stat(tarball);
  } catch {
    throw new Error(`pnpm pack did not produce expected tarball for ${pkg.manifest.name}: ${tarball}`);
  }
  const tarballStat = await stat(tarball);
  const extractDir = await mkdtemp(join(tmpdir(), "a11yst-pack-extract-"));

  try {
    execFileSync("tar", ["-xzf", tarball, "-C", extractDir], { stdio: "pipe" });
    const packageRoot = join(extractDir, "package");
    const files = await listFilesRecursive(packageRoot);
    const normalizedFiles = files
      .map((file) => relative(extractDir, file).split("\\").join("/"))
      .sort((left, right) => left.localeCompare(right));
    const manifest = JSON.parse(
      await readFile(join(packageRoot, "package.json"), "utf8"),
    ) as Record<string, unknown>;

    const unexpectedFiles = normalizedFiles.filter((file) => isForbiddenTarballPath(file));
    const requiredFiles = collectRequiredFiles(manifest, normalizedFiles);

    return {
      packageName: String(manifest.name),
      version: String(manifest.version),
      tarball,
      fileCount: normalizedFiles.length,
      sizeBytes: tarballStat.size,
      manifest,
      files: normalizedFiles,
      requiredFiles,
      unexpectedFiles,
    };
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }
}

async function listFilesRecursive(root: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const next = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(root, next)));
    } else if (entry.isFile()) {
      files.push(join(root, next));
    }
  }

  return files;
}

function isForbiddenTarballPath(path: string): boolean {
  if (FORBIDDEN_EXACT.includes(path)) {
    return true;
  }
  if (FORBIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return true;
  }
  if (path.startsWith("package/.env.")) {
    return true;
  }
  if (path.endsWith(".log") && path.startsWith("package/")) {
    return true;
  }
  return false;
}

function collectRequiredFiles(manifest: Record<string, unknown>, files: string[]): string[] {
  const required: string[] = ["package/package.json"];
  const manifestFiles = manifest.files as string[] | undefined;
  if (manifestFiles?.includes("LICENSE")) {
    required.push("package/LICENSE");
  }
  if (manifestFiles?.includes("README.md")) {
    required.push("package/README.md");
  }
  if (manifestFiles?.includes("NOTICE.md")) {
    required.push("package/NOTICE.md");
  }
  if (manifestFiles?.includes("TRADEMARKS.md")) {
    required.push("package/TRADEMARKS.md");
  }
  const bin = manifest.bin as Record<string, string> | undefined;
  if (bin) {
    for (const target of Object.values(bin)) {
      required.push(`package/${target.replace(/^\.\//, "")}`);
    }
  }
  if (files.some((file) => file.startsWith("package/dist/"))) {
    required.push("package/dist");
  }
  return required.filter((entry, index, array) => array.indexOf(entry) === index);
}

export function findWorkspaceProtocolInManifest(manifest: Record<string, unknown>): string[] {
  const offenders: string[] = [];
  for (const section of ["dependencies", "optionalDependencies", "peerDependencies"] as const) {
    const values = manifest[section];
    if (!values || typeof values !== "object") {
      continue;
    }
    for (const [name, range] of Object.entries(values as Record<string, string>)) {
      if (typeof range === "string" && isWorkspaceDependencyRange(range)) {
        offenders.push(`${section}.${name}=${range}`);
      }
    }
  }
  return offenders.sort((left, right) => left.localeCompare(right));
}

export async function scanTarballForSensitiveValues(
  tarball: string,
  sensitiveValues: string[],
  repoRoot = getRepoRoot(),
): Promise<string[]> {
  const matches: string[] = [];
  const textExtensions = [".js", ".json", ".md", ".txt", ".d.ts", ".map"];
  const extractDir = await mkdtemp(join(tmpdir(), "a11yst-pack-scan-"));

  try {
    execFileSync("tar", ["-xzf", tarball, "-C", extractDir], { stdio: "pipe" });
    const packageRoot = join(extractDir, "package");
    const files = await listFilesRecursive(packageRoot);
    const tarballDir = join(tarball, "..");

    for (const absoluteFile of files) {
      const relativePath = relative(extractDir, absoluteFile).split("\\").join("/");
      if (!textExtensions.some((extension) => relativePath.endsWith(extension))) {
        continue;
      }
      const text = await readFile(absoluteFile, "utf8");
      for (const value of sensitiveValues) {
        if (text.includes(value)) {
          matches.push(`${relativePath}:${value}`);
        }
      }
      if (text.includes(repoRoot)) {
        matches.push(`${relativePath}:repo-root`);
      }
      if (text.includes(homedir())) {
        matches.push(`${relativePath}:home`);
      }
      if (text.includes(tarballDir)) {
        matches.push(`${relativePath}:temp-pack-path`);
      }
    }
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }

  return matches.sort((left, right) => left.localeCompare(right));
}

export async function readTarballPackageFile(
  tarball: string,
  relativePath: string,
): Promise<string> {
  const extractDir = await mkdtemp(join(tmpdir(), "a11yst-pack-read-"));
  try {
    execFileSync("tar", ["-xzf", tarball, "-C", extractDir, `package/${relativePath}`], {
      stdio: "pipe",
    });
    return await readFile(join(extractDir, "package", relativePath), "utf8");
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }
}

export async function createPackDestination(prefix = "a11yst-13g-pack-"): Promise<string> {
  assertTarAvailable();
  return mkdtemp(join(tmpdir(), prefix));
}

export async function packAllowlistExcludesSensitiveFiles(): Promise<boolean> {
  const tempRoot = await mkdtemp(join(tmpdir(), "a11yst-pack-allowlist-"));
  const packageDir = join(tempRoot, "package");
  const destination = join(tempRoot, "packed");

  try {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(packageDir, "dist"), { recursive: true });
    await mkdir(destination, { recursive: true });
    await writeFile(
      join(packageDir, "package.json"),
      JSON.stringify(
        {
          name: "@fixture/pack-allowlist",
          version: "0.0.0",
          type: "module",
          files: ["dist"],
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(join(packageDir, "dist", "index.js"), "export {};\n", "utf8");
    await writeFile(join(packageDir, ".env"), "A11YST_PACK_SECRET_13G=1", "utf8");
    await writeFile(join(packageDir, "pack-secret.log"), "A11YST_PACK_SECRET_13G", "utf8");

    const copiedPackage: LoadedWorkspacePackage = {
      dirRelative: "fixture/pack-allowlist",
      dirAbsolute: packageDir,
      manifest: {
        name: "@fixture/pack-allowlist",
        version: "0.0.0",
        files: ["dist"],
      },
    };

    const result = await packPackage(copiedPackage, destination);
    return (
      !result.files.some((file) => file.includes(".env")) &&
      !result.files.some((file) => file.endsWith(".log"))
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function normalizeManifestForComparison(manifest: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    name: manifest.name,
    version: manifest.version,
    type: manifest.type,
    main: manifest.main,
    module: manifest.module,
    types: manifest.types,
    exports: manifest.exports,
    bin: manifest.bin,
    files: manifest.files,
    license: manifest.license,
    engines: manifest.engines,
  };

  for (const section of ["dependencies", "optionalDependencies", "peerDependencies"] as const) {
    const values = manifest[section];
    if (!values || typeof values !== "object") {
      continue;
    }
    normalized[section] = Object.fromEntries(
      Object.entries(values as Record<string, string>).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  }

  return normalized;
}

export function compareSemanticPackResults(
  first: PackagePackResult,
  second: PackagePackResult,
): { equal: boolean; differences: string[] } {
  const differences: string[] = [];

  if (first.packageName !== second.packageName) {
    differences.push("packageName");
  }
  if (first.version !== second.version) {
    differences.push("version");
  }
  if (first.files.join("\n") !== second.files.join("\n")) {
    differences.push("files");
  }

  const firstManifest = JSON.stringify(normalizeManifestForComparison(first.manifest));
  const secondManifest = JSON.stringify(normalizeManifestForComparison(second.manifest));
  if (firstManifest !== secondManifest) {
    differences.push("manifest");
  }

  return { equal: differences.length === 0, differences };
}
