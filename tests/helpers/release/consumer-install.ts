import { spawnSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeRuntimeClosure,
  toMinimalPackageMap,
  topologicalPublishOrder,
} from "./package-graph.js";
import { packPackage } from "./pack-inspect.js";
import {
  findCliPackage,
  getRepoRoot,
  loadWorkspacePackages,
} from "./workspace-packages.js";

export const CONSUMER_ENTRY_PACKAGE = "@a11yst/cli";
export const CONSUMER_PACKAGE_VERSION = "1.0.0";
export const CONSUMER_FIXTURE_NAME = "a11yst-consumer-fixture";
export const A11YST_REGISTRY_GUARD = "@a11yst:registry=http://127.0.0.1:9/\n";
export const CONSUMER_SECRET = "A11YST_CONSUMER_SECRET_13H";
export const CONSUMER_SOURCE_MARKER = "A11YST_CONSUMER_SOURCE_MARKER_13H";

const helperDir = dirname(fileURLToPath(import.meta.url));
export const CONSUMER_FIXTURE_ROOT = resolve(helperDir, "../../fixtures/release/consumer-app");

export type CommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

export type ConsumerProjectManifest = {
  name: string;
  private: boolean;
  type: "module";
  packageManager: string;
  dependencies: Record<string, string>;
  pnpm: {
    overrides: Record<string, string>;
  };
};

export type TarballMap = Map<string, string>;

export function tarballFileName(packageName: string, version = CONSUMER_PACKAGE_VERSION): string {
  return `${packageName.replace("@a11yst/", "a11yst-")}-${version}.tgz`;
}

export function toRelativeTarballReference(fromDir: string, tarballPath: string): string {
  return `file:${relative(fromDir, tarballPath).split("\\").join("/")}`;
}

export function buildConsumerProjectManifest(options: {
  consumerDir: string;
  cliPackageName: string;
  publishableClosure: string[];
  tarballByPackage: TarballMap;
}): ConsumerProjectManifest {
  const directTarball = options.tarballByPackage.get(options.cliPackageName);
  if (!directTarball) {
    throw new Error(`Missing tarball for consumer entry package ${options.cliPackageName}`);
  }

  const overrides: Record<string, string> = {};
  for (const packageName of options.publishableClosure) {
    const tarballPath = options.tarballByPackage.get(packageName);
    if (!tarballPath) {
      throw new Error(`Missing tarball for ${packageName}`);
    }
    overrides[packageName] = toRelativeTarballReference(
      options.consumerDir,
      tarballPath,
    );
  }

  const sortedOverrides = Object.fromEntries(
    Object.entries(overrides).sort(([left], [right]) => left.localeCompare(right)),
  );

  return {
    name: CONSUMER_FIXTURE_NAME,
    private: true,
    type: "module",
    packageManager: "pnpm@9.15.0",
    dependencies: {
      [options.cliPackageName]: CONSUMER_PACKAGE_VERSION,
    },
    pnpm: {
      overrides: sortedOverrides,
    },
  };
}

export function validateConsumerProjectManifest(manifest: ConsumerProjectManifest): string[] {
  const issues: string[] = [];
  const a11ystDependencies = Object.keys(manifest.dependencies).filter((name) =>
    name.startsWith("@a11yst/"),
  );

  if (a11ystDependencies.length !== 1 || a11ystDependencies[0] !== CONSUMER_ENTRY_PACKAGE) {
    issues.push("consumer-direct-a11yst-dependencies");
  }

  for (const value of Object.values(manifest.dependencies)) {
    if (value.includes("workspace:")) {
      issues.push("workspace-protocol-in-direct-dependencies");
    }
    if (value.includes("/packages/")) {
      issues.push("monorepo-path-in-direct-dependencies");
    }
  }

  for (const [key, value] of Object.entries(manifest.pnpm.overrides)) {
    if (value.includes("workspace:")) {
      issues.push(`workspace-protocol-in-override:${key}`);
    }
    if (value.includes("/packages/")) {
      issues.push(`monorepo-path-in-override:${key}`);
    }
    if (!value.startsWith("file:../packs/")) {
      issues.push(`unexpected-override-path:${key}`);
    }
  }

  const overridePackages = Object.keys(manifest.pnpm.overrides);
  const duplicates = overridePackages.filter(
    (name, index) => overridePackages.indexOf(name) !== index,
  );
  if (duplicates.length > 0) {
    issues.push("duplicate-overrides");
  }

  return issues.sort((left, right) => left.localeCompare(right));
}

export async function packPublishableClosure(packDir: string): Promise<{
  tarballByPackage: TarballMap;
  publishableClosure: string[];
}> {
  await mkdir(packDir, { recursive: true });
  const packages = await loadWorkspacePackages();
  const cli = findCliPackage(packages);
  if (!cli) {
    throw new Error("Consumer packaging requires a CLI package with bin.a11yst");
  }

  const map = toMinimalPackageMap(packages);
  const { closure, issues } = computeRuntimeClosure(map, cli.manifest.name);
  if (issues.length > 0) {
    throw new Error(`Publishable closure has graph issues: ${JSON.stringify(issues)}`);
  }

  const order = topologicalPublishOrder(map, closure);
  const tarballByPackage: TarballMap = new Map();

  for (const packageName of order) {
    const pkg = packages.find((entry) => entry.manifest.name === packageName);
    if (!pkg) {
      throw new Error(`Missing workspace package ${packageName}`);
    }
    const result = await packPackage(pkg, packDir);
    tarballByPackage.set(packageName, result.tarball);
  }

  return { tarballByPackage, publishableClosure: order };
}

export async function writeConsumerProject(options: {
  consumerDir: string;
  tarballByPackage: TarballMap;
  publishableClosure: string[];
}): Promise<ConsumerProjectManifest> {
  await cp(CONSUMER_FIXTURE_ROOT, options.consumerDir, { recursive: true });
  const manifest = buildConsumerProjectManifest({
    consumerDir: options.consumerDir,
    cliPackageName: CONSUMER_ENTRY_PACKAGE,
    publishableClosure: options.publishableClosure,
    tarballByPackage: options.tarballByPackage,
  });
  await writeFile(join(options.consumerDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(join(options.consumerDir, ".npmrc"), A11YST_REGISTRY_GUARD, "utf8");
  return manifest;
}

export function runPnpm(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): CommandResult {
  const result = spawnSync("pnpm", args, {
    cwd,
    encoding: "utf8",
    shell: false,
    env: {
      ...process.env,
      NO_COLOR: "1",
      ...env,
    },
  });
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export function runInstalledA11yst(
  consumerDir: string,
  args: string[],
  env: NodeJS.ProcessEnv = {},
  options: { timeoutMs?: number } = {},
): CommandResult {
  const result = spawnSync("pnpm", ["exec", "a11yst", ...args], {
    cwd: consumerDir,
    encoding: "utf8",
    shell: false,
    timeout: options.timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      NO_COLOR: "1",
      ...env,
    },
  });
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export function runInstalledBin(
  consumerDir: string,
  args: string[],
  options: { timeoutMs?: number } = {},
): CommandResult {
  const binPath = join(consumerDir, "node_modules", ".bin", "a11yst");
  const result = spawnSync(binPath, args, {
    cwd: consumerDir,
    encoding: "utf8",
    shell: false,
    timeout: options.timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      NO_COLOR: "1",
    },
  });
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export async function consumerBinExists(consumerDir: string): Promise<boolean> {
  try {
    await access(join(consumerDir, "node_modules", ".bin", "a11yst"));
    return true;
  } catch {
    return false;
  }
}

export async function installConsumerProjectWithFallback(consumerDir: string): Promise<{
  result: CommandResult;
  offlineAttempted: boolean;
  offlineSucceeded: boolean;
}> {
  await rm(join(consumerDir, "node_modules"), { recursive: true, force: true }).catch(() => undefined);
  await rm(join(consumerDir, "pnpm-lock.yaml"), { force: true }).catch(() => undefined);

  const offlineResult = await installConsumerProject(consumerDir, { offline: true });
  if (offlineResult.code === 0 && (await consumerBinExists(consumerDir))) {
    return {
      result: offlineResult,
      offlineAttempted: true,
      offlineSucceeded: true,
    };
  }

  await rm(join(consumerDir, "node_modules"), { recursive: true, force: true }).catch(() => undefined);
  await rm(join(consumerDir, "pnpm-lock.yaml"), { force: true }).catch(() => undefined);
  const onlineResult = await installConsumerProject(consumerDir);
  return {
    result: onlineResult,
    offlineAttempted: true,
    offlineSucceeded: false,
  };
}

export async function frozenReinstallConsumerProjectWithFallback(
  consumerDir: string,
): Promise<CommandResult> {
  const offlineResult = await frozenReinstallConsumerProject(consumerDir, { offline: true });
  if (offlineResult.code === 0 && (await consumerBinExists(consumerDir))) {
    return offlineResult;
  }
  return frozenReinstallConsumerProject(consumerDir);
}

export async function installConsumerProject(
  consumerDir: string,
  options: { offline?: boolean } = {},
): Promise<CommandResult> {
  const args = ["install"];
  if (options.offline) {
    args.push("--offline");
  }
  return runPnpm(args, consumerDir);
}

export async function frozenReinstallConsumerProject(
  consumerDir: string,
  options: { offline?: boolean } = {},
): Promise<CommandResult> {
  const args = ["install", "--frozen-lockfile"];
  if (options.offline) {
    args.push("--offline");
  }
  return runPnpm(args, consumerDir);
}

export async function readConsumerLockfile(consumerDir: string): Promise<string> {
  return readFile(join(consumerDir, "pnpm-lock.yaml"), "utf8");
}

export async function listInstalledPackages(consumerDir: string): Promise<unknown> {
  const result = runPnpm(["list", "--depth", "Infinity", "--json"], consumerDir);
  if (result.code !== 0) {
    throw new Error(`pnpm list failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout) as unknown;
}

export function collectInstalledA11ystPackageNames(payload: unknown): string[] {
  const names = new Set<string>();

  function visit(node: unknown, packageName?: string): void {
    if (!node || typeof node !== "object") {
      return;
    }
    const record = node as Record<string, unknown>;
    const resolvedName =
      typeof record.name === "string"
        ? record.name
        : typeof packageName === "string"
          ? packageName
          : undefined;
    if (resolvedName?.startsWith("@a11yst/")) {
      names.add(resolvedName);
    }

    const nestedGroups = [
      record.dependencies,
      record.devDependencies,
      record.optionalDependencies,
      record.peerDependencies,
    ];
    for (const group of nestedGroups) {
      if (Array.isArray(group)) {
        for (const dependency of group) {
          visit(dependency);
        }
        continue;
      }
      if (group && typeof group === "object") {
        for (const [dependencyName, dependency] of Object.entries(
          group as Record<string, unknown>,
        )) {
          visit(dependency, dependencyName);
        }
      }
    }
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      visit(entry);
    }
  } else {
    visit(payload);
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

export async function resolveInstalledCliRealpath(consumerDir: string): Promise<string> {
  return realpath(join(consumerDir, "node_modules", ".bin", "a11yst"));
}

export async function assertInstalledPackagesIndependent(options: {
  consumerDir: string;
  repoRoot?: string;
  expectedClosure: string[];
}): Promise<void> {
  const repoRoot = options.repoRoot ?? getRepoRoot();
  const cliRealpath = await resolveInstalledCliRealpath(options.consumerDir);
  if (cliRealpath.includes(join(repoRoot, "packages"))) {
    throw new Error(`Installed CLI resolves into repository packages: ${cliRealpath}`);
  }

  const lockfile = await readConsumerLockfile(options.consumerDir);
  if (lockfile.includes(repoRoot)) {
    throw new Error("Consumer lockfile references repository root");
  }
  if (lockfile.includes("workspace:")) {
    throw new Error("Consumer lockfile contains workspace protocol");
  }
  if (/link:.*\/packages\//.test(lockfile)) {
    throw new Error("Consumer lockfile links to monorepo packages");
  }

  const installed = collectInstalledA11ystPackageNames(await listInstalledPackages(options.consumerDir));
  for (const expected of options.expectedClosure) {
    if (!installed.includes(expected)) {
      throw new Error(`Missing installed a11yst package ${expected}`);
    }
  }
}

export async function readLatestConsumerResults(consumerDir: string): Promise<{
  runDir: string;
  resultsPath: string;
  results: Record<string, unknown>;
}> {
  const latest = JSON.parse(
    await readFile(join(consumerDir, ".a11yst/results/latest.json"), "utf8"),
  ) as { resultsPath: string };
  const resultsPath = join(consumerDir, ".a11yst/results", latest.resultsPath);
  const runDir = dirname(resultsPath);
  const results = JSON.parse(await readFile(resultsPath, "utf8")) as Record<string, unknown>;
  return { runDir, resultsPath, results };
}

export function scanTextForSensitiveValues(
  text: string,
  options: {
    repoRoot?: string;
    homeDir?: string;
    tempRoot?: string;
    secret?: string;
    sourceMarker?: string;
  } = {},
): string[] {
  const repoRoot = options.repoRoot ?? getRepoRoot();
  const homeDir = options.homeDir ?? homedir();
  const matches: string[] = [];

  if (options.secret && text.includes(options.secret)) {
    matches.push("secret");
  }
  if (options.sourceMarker && text.includes(options.sourceMarker)) {
    matches.push("source-marker");
  }
  if (text.includes(repoRoot)) {
    matches.push("repo-root");
  }
  if (text.includes(homeDir)) {
    matches.push("home");
  }
  if (options.tempRoot && text.includes(options.tempRoot)) {
    matches.push("temp-root");
  }

  return matches;
}

export async function createConsumerScenarioRoot(prefix = "a11yst-13h-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function removeConsumerScenarioRoot(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

export function summarizeCommandFailure(label: string, result: CommandResult): string {
  const stdoutTail = result.stdout.split("\n").slice(-8).join("\n");
  const stderrTail = result.stderr.split("\n").slice(-8).join("\n");
  return `${label} failed with exit ${result.code ?? "null"}\nstdout tail:\n${stdoutTail}\nstderr tail:\n${stderrTail}`;
}
