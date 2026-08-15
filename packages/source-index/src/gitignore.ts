import ignore, { type Ignore } from "ignore";
import type { SourceIndexFileSystem } from "./filesystem.js";
import { createSourceIndexDiagnostic } from "./diagnostics.js";

export type GitignoreState = {
  matcher: Ignore;
  readFailed: boolean;
};

export function createEmptyGitignoreMatcher(): Ignore {
  return ignore();
}

export async function loadRootGitignore(
  filesystem: SourceIndexFileSystem,
  canonicalRoot: string,
  extraPatterns: string[] = [],
): Promise<{ matcher: Ignore; diagnostics: ReturnType<typeof createSourceIndexDiagnostic>[] }> {
  const gitignorePath = `${canonicalRoot}/.gitignore`;
  const matcher = ignore();

  try {
    const content = await filesystem.readFile(gitignorePath, "utf8");
    matcher.add(content);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      // Missing root .gitignore is allowed.
    } else {
      return {
        matcher,
        diagnostics: [createSourceIndexDiagnostic("gitignore-read-failed", "warning")],
      };
    }
  }

  if (extraPatterns.length > 0) {
    matcher.add(extraPatterns);
  }

  return { matcher, diagnostics: [] };
}

export function buildIgnoreMatcher(
  gitignoreMatcher: Ignore,
  explicitPatterns: string[],
): Ignore {
  if (explicitPatterns.length === 0) {
    return gitignoreMatcher;
  }
  const matcher = ignore();
  matcher.add(gitignoreMatcher);
  matcher.add(explicitPatterns);
  return matcher;
}

export function isIgnoredPath(matcher: Ignore, repositoryRelativeUri: string): boolean {
  return matcher.ignores(repositoryRelativeUri);
}
