import { access } from "node:fs/promises";
import { join } from "node:path";
import type { LoadedWorkspacePackage } from "./workspace-packages.js";

export type ExportTargetIssue = {
  packageName: string;
  field: string;
  target: string;
  reason: "missing-target";
};

function collectExportStrings(value: unknown, bucket: string[]): void {
  if (typeof value === "string") {
    bucket.push(value);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const nested of Object.values(value as Record<string, unknown>)) {
    collectExportStrings(nested, bucket);
  }
}

export function collectManifestTargets(manifest: LoadedWorkspacePackage["manifest"]): Array<{
  field: string;
  target: string;
}> {
  const targets: Array<{ field: string; target: string }> = [];

  if (manifest.main) {
    targets.push({ field: "main", target: manifest.main });
  }
  if (manifest.module) {
    targets.push({ field: "module", target: manifest.module });
  }
  if (manifest.types) {
    targets.push({ field: "types", target: manifest.types });
  }
  if (manifest.bin) {
    for (const [binName, target] of Object.entries(manifest.bin)) {
      targets.push({ field: `bin.${binName}`, target });
    }
  }

  const exportStrings: string[] = [];
  collectExportStrings(manifest.exports, exportStrings);
  for (const target of exportStrings) {
    if (target.startsWith("./") || target.startsWith("../")) {
      targets.push({ field: "exports", target });
    }
  }

  return targets;
}

export async function findMissingExportTargets(
  pkg: LoadedWorkspacePackage,
): Promise<ExportTargetIssue[]> {
  const issues: ExportTargetIssue[] = [];

  for (const { field, target } of collectManifestTargets(pkg.manifest)) {
    const absoluteTarget = join(pkg.dirAbsolute, target);
    try {
      await access(absoluteTarget);
    } catch {
      issues.push({
        packageName: pkg.manifest.name,
        field,
        target,
        reason: "missing-target",
      });
    }
  }

  return issues;
}
