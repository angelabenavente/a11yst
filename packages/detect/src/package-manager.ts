import { join } from "node:path";
import type {
  DetectionEvidence,
  Diagnostic,
  PackageManagerDetection,
  PackageManagerName,
} from "@a11yst/types";
import { pathExists } from "./filesystem.js";
import type { PackageManifest } from "./manifests.js";
import { sortEvidence } from "./evidence.js";

/** Lockfile candidates, in filename-check order (bun has two possible names). */
const LOCKFILES: ReadonlyArray<{ name: PackageManagerName; file: string }> = [
  { name: "pnpm", file: "pnpm-lock.yaml" },
  { name: "npm", file: "package-lock.json" },
  { name: "yarn", file: "yarn.lock" },
  { name: "bun", file: "bun.lock" },
  { name: "bun", file: "bun.lockb" },
];

/**
 * Deterministic tie-break order used when multiple lockfiles are present
 * and no `packageManager` field disambiguates them.
 */
export const LOCKFILE_PRIORITY: readonly PackageManagerName[] = [
  "pnpm",
  "yarn",
  "bun",
  "npm",
];

const KNOWN_PACKAGE_MANAGER_NAMES: ReadonlySet<PackageManagerName> = new Set([
  "pnpm",
  "npm",
  "yarn",
  "bun",
]);

function parsePackageManagerField(field: string): PackageManagerName | undefined {
  const match = /^([a-zA-Z-]+)@/.exec(field.trim());
  const name = match?.[1]?.toLowerCase();
  if (name && KNOWN_PACKAGE_MANAGER_NAMES.has(name as PackageManagerName)) {
    return name as PackageManagerName;
  }
  return undefined;
}

/**
 * Detect the package manager for a single project root from lockfiles and
 * the `package.json` `packageManager` field. Never reads network state or
 * installed binaries — filesystem + manifest evidence only.
 *
 * Priority when signals disagree (highest first): `packageManager` field,
 * then lockfile presence using `pnpm > yarn > bun > npm`. The outcome is
 * always deterministic; conflicts are reported via diagnostics, not thrown.
 */
export function detectPackageManager(
  rootDir: string,
  manifest: PackageManifest | undefined,
): PackageManagerDetection {
  const evidence: DetectionEvidence[] = [];
  const diagnostics: Diagnostic[] = [];

  const presentLocks = new Map<PackageManagerName, string>();
  for (const { name, file } of LOCKFILES) {
    if (!presentLocks.has(name) && pathExists(join(rootDir, file))) {
      presentLocks.set(name, file);
    }
  }
  for (const [name, file] of presentLocks) {
    evidence.push({
      type: "file",
      value: file,
      description: `Lockfile "${file}" indicates the "${name}" package manager.`,
      weight: 2,
    });
  }

  let fieldName: PackageManagerName | undefined;
  const field = manifest?.packageManager;
  if (typeof field === "string" && field.length > 0) {
    fieldName = parsePackageManagerField(field);
    if (fieldName) {
      evidence.push({
        type: "configuration",
        value: field,
        description: `package.json "packageManager" field specifies "${field}".`,
        weight: 3,
      });
    } else {
      diagnostics.push({
        code: "PACKAGE_MANAGER_FIELD_UNRECOGNIZED",
        severity: "warning",
        message: `Unrecognized "packageManager" field value: "${field}".`,
        hint: "Expected a value like \"pnpm@9.15.0\", \"npm@10.0.0\", \"yarn@4.0.0\", or \"bun@1.1.0\".",
        path: join(rootDir, "package.json"),
      });
    }
  }

  const presentNames = [...presentLocks.keys()];
  let name: PackageManagerName;
  let confidence: PackageManagerDetection["confidence"];

  if (fieldName) {
    name = fieldName;
    const agrees = presentNames.length === 0 || (presentNames.length === 1 && presentNames[0] === fieldName);
    if (presentNames.length === 0) {
      confidence = "high";
    } else if (agrees) {
      confidence = "certain";
    } else {
      confidence = "high";
      diagnostics.push({
        code: "PACKAGE_MANAGER_CONFLICT",
        severity: "warning",
        message: `package.json "packageManager" specifies "${fieldName}", but lockfile(s) found for: ${presentNames.join(", ")}. Using "${fieldName}" because the packageManager field takes priority over lockfiles.`,
        hint: "Remove stale lockfiles or update the packageManager field so they agree.",
        path: rootDir,
      });
    }
  } else if (presentNames.length > 0) {
    const sorted = [...presentNames].sort(
      (a, b) => LOCKFILE_PRIORITY.indexOf(a) - LOCKFILE_PRIORITY.indexOf(b),
    );
    name = sorted[0]!;
    confidence = sorted.length === 1 ? "high" : "medium";
    if (sorted.length > 1) {
      diagnostics.push({
        code: "PACKAGE_MANAGER_CONFLICT",
        severity: "warning",
        message: `Multiple lockfiles found (${sorted.join(", ")}). Selected "${name}" using priority order pnpm > yarn > bun > npm.`,
        hint: "Remove unused lockfiles to avoid ambiguity.",
        path: rootDir,
      });
    }
  } else {
    name = "unknown";
    confidence = "unknown";
    diagnostics.push({
      code: "PACKAGE_MANAGER_UNKNOWN",
      severity: "info",
      message: "No lockfile or packageManager field found; the package manager could not be determined.",
      path: rootDir,
    });
  }

  return {
    name,
    confidence,
    evidence: sortEvidence(evidence),
    diagnostics,
  };
}
