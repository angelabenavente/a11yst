import type { LoadedWorkspacePackage, WorkspacePackageManifest } from "./workspace-packages.js";
import { isWorkspacePackageName } from "./workspace-packages.js";

export type GraphIssue =
  | { kind: "missing-workspace-dependency"; packageName: string; dependency: string }
  | { kind: "private-runtime-dependency"; packageName: string; dependency: string };

export type RuntimeGraphResult = {
  closure: string[];
  issues: GraphIssue[];
  cycles: string[][];
};

export type MinimalPackageRecord = {
  name: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

function runtimeDependencyNames(manifest: WorkspacePackageManifest | MinimalPackageRecord): string[] {
  return [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ];
}

function comparePackages(left: string, right: string): number {
  return left.localeCompare(right);
}

export function computeRuntimeClosure(
  packageMap: Map<string, MinimalPackageRecord & { name: string }>,
  rootName: string,
): RuntimeGraphResult {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const issues: GraphIssue[] = [];
  const closure = new Set<string>();

  function visit(packageName: string): void {
    if (visited.has(packageName)) {
      return;
    }
    if (visiting.has(packageName)) {
      const cycleStart = stack.indexOf(packageName);
      cycles.push(stack.slice(cycleStart).concat(packageName));
      return;
    }

    const pkg = packageMap.get(packageName);
    if (!pkg) {
      issues.push({
        kind: "missing-workspace-dependency",
        packageName: rootName,
        dependency: packageName,
      });
      return;
    }

    visiting.add(packageName);
    stack.push(packageName);
    closure.add(packageName);

    for (const dependency of runtimeDependencyNames(pkg)) {
      if (!isWorkspacePackageName(dependency, packageMap)) {
        continue;
      }

      const dependencyPackage = packageMap.get(dependency);
      if (!dependencyPackage) {
        issues.push({
          kind: "missing-workspace-dependency",
          packageName: pkg.name,
          dependency,
        });
        continue;
      }

      if (dependencyPackage.private) {
        issues.push({
          kind: "private-runtime-dependency",
          packageName: pkg.name,
          dependency,
        });
      }

      visit(dependency);
    }

    stack.pop();
    visiting.delete(packageName);
    visited.add(packageName);
  }

  visit(rootName);

  const ordered = [...closure].sort(comparePackages);
  cycles.sort((left, right) => left.join(">").localeCompare(right.join(">")));

  return {
    closure: ordered,
    issues: issues.sort((left, right) =>
      `${left.kind}:${left.packageName}:${left.dependency}`.localeCompare(
        `${right.kind}:${right.packageName}:${right.dependency}`,
      ),
    ),
    cycles,
  };
}

export function toMinimalPackageMap(
  packages: LoadedWorkspacePackage[],
): Map<string, MinimalPackageRecord & { name: string }> {
  return new Map(
    packages.map((pkg) => [
      pkg.manifest.name,
      {
        name: pkg.manifest.name,
        private: pkg.manifest.private,
        dependencies: pkg.manifest.dependencies,
        optionalDependencies: pkg.manifest.optionalDependencies,
        peerDependencies: pkg.manifest.peerDependencies,
      },
    ]),
  );
}

export function topologicalPublishOrder(
  packageMap: Map<string, MinimalPackageRecord & { name: string }>,
  closure: string[],
): string[] {
  const closureSet = new Set(closure);
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, Set<string>>();

  for (const name of closure) {
    indegree.set(name, 0);
    outgoing.set(name, new Set());
  }

  for (const name of closure) {
    const pkg = packageMap.get(name);
    if (!pkg) {
      continue;
    }
    for (const dependency of runtimeDependencyNames(pkg)) {
      if (!closureSet.has(dependency)) {
        continue;
      }
      outgoing.get(dependency)?.add(name);
      indegree.set(name, (indegree.get(name) ?? 0) + 1);
    }
  }

  const queue = [...closure].filter((name) => (indegree.get(name) ?? 0) === 0).sort(comparePackages);
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    order.push(current);
    const targets = [...(outgoing.get(current) ?? [])].sort(comparePackages);
    for (const target of targets) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) {
        queue.push(target);
        queue.sort(comparePackages);
      }
    }
  }

  if (order.length !== closure.length) {
    return [...closure].sort(comparePackages);
  }

  return order;
}
