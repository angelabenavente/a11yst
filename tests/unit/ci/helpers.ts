import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export const CI_PATHS = {
  githubBase: join(repoRoot, "examples/ci/github-actions/a11yst-ci.yml"),
  githubCodeScanning: join(
    repoRoot,
    "examples/ci/github-actions/a11yst-code-scanning.yml",
  ),
  gitlab: join(repoRoot, "examples/ci/gitlab/a11yst.gitlab-ci.yml"),
  exampleConfig: join(repoRoot, "examples/ci/a11yst.config.ts"),
  ciDocs: join(repoRoot, "docs/ci.md"),
  examplesReadme: join(repoRoot, "examples/ci/README.md"),
  readme: join(repoRoot, "README.md"),
  nvmrc: join(repoRoot, ".nvmrc"),
  packageJson: join(repoRoot, "package.json"),
} as const;

export function readTemplate(path: string): string {
  return readFileSync(path, "utf8");
}

export function parseTemplate(path: string): unknown {
  return parseYaml(readFileSync(path, "utf8"));
}

export function flattenYamlStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(flattenYamlStrings);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(flattenYamlStrings);
  }
  return [];
}

export function collectRunScripts(doc: unknown): string[] {
  const scripts: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        if (typeof item === "string") {
          scripts.push(item);
        } else {
          visit(item);
        }
      }
      return;
    }
    const record = node as Record<string, unknown>;
    if (typeof record.run === "string") {
      scripts.push(record.run);
    }
    for (const key of ["script", "before_script"] as const) {
      const value = record[key];
      if (typeof value === "string") {
        scripts.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string") {
            scripts.push(item);
          }
        }
      }
    }
    for (const value of Object.values(record)) {
      if (value !== record.script && value !== record.before_script && value !== record.run) {
        visit(value);
      }
    }
  };
  visit(doc);
  return scripts;
}

export function countOccurrences(haystack: string, needle: string | RegExp): number {
  if (typeof needle === "string") {
    let count = 0;
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      count += 1;
      index = haystack.indexOf(needle, index + needle.length);
    }
    return count;
  }
  const matches = haystack.match(needle);
  return matches ? matches.length : 0;
}

export function getGitHubJob(doc: Record<string, unknown>): Record<string, unknown> {
  const jobs = doc.jobs as Record<string, Record<string, unknown>>;
  if (!jobs?.a11yst) {
    throw new Error("Expected jobs.a11yst in GitHub Actions template");
  }
  return jobs.a11yst;
}

export function getStepTexts(steps: unknown[]): string {
  return steps
    .flatMap((step) => {
      if (!step || typeof step !== "object") {
        return [];
      }
      const record = step as Record<string, unknown>;
      const parts: string[] = [];
      if (typeof record.name === "string") {
        parts.push(record.name);
      }
      if (typeof record.run === "string") {
        parts.push(record.run);
      }
      if (typeof record.uses === "string") {
        parts.push(record.uses);
      }
      if (typeof record.if === "string") {
        parts.push(record.if);
      }
      return parts;
    })
    .join("\n");
}
