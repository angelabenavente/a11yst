import type { SourceIndexDiagnostic, SourceIndexDiagnosticCode } from "@a11yst/types";

const MESSAGES: Record<SourceIndexDiagnosticCode, string> = {
  "invalid-repository-root": "Repository root path is invalid",
  "repository-root-not-found": "Repository root was not found",
  "repository-root-not-directory": "Repository root is not a directory",
  "unsafe-scope-root": "Scope root URI is unsafe or escapes the repository",
  "scope-not-found": "Scope root was not found",
  "scope-not-directory": "Scope root is not a directory",
  "gitignore-read-failed": "Root .gitignore could not be read",
  "permission-denied": "Permission denied while reading the repository",
  "directory-read-failed": "Directory could not be read",
  "symlink-skipped": "Symbolic link was skipped",
  "file-limit-reached": "Indexed file limit was reached",
  "depth-limit-reached": "Maximum directory depth was reached",
  "duplicate-file": "File was indexed from multiple scopes",
  "file-disappeared": "File disappeared during indexing",
};

const LEVEL_ORDER: Record<SourceIndexDiagnostic["level"], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export function createSourceIndexDiagnostic(
  code: SourceIndexDiagnosticCode,
  level: SourceIndexDiagnostic["level"],
  message?: string,
  fields?: { uri?: string; scopeId?: string },
): SourceIndexDiagnostic {
  const diagnostic: SourceIndexDiagnostic = {
    code,
    level,
    message: message ?? MESSAGES[code],
  };
  if (fields?.uri !== undefined) {
    diagnostic.uri = fields.uri;
  }
  if (fields?.scopeId !== undefined) {
    diagnostic.scopeId = fields.scopeId;
  }
  return diagnostic;
}

export function compareSourceIndexDiagnostics(
  left: SourceIndexDiagnostic,
  right: SourceIndexDiagnostic,
): number {
  const levelOrder = LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level];
  if (levelOrder !== 0) {
    return levelOrder;
  }
  const codeOrder = left.code.localeCompare(right.code);
  if (codeOrder !== 0) {
    return codeOrder;
  }
  const scopeOrder = (left.scopeId ?? "").localeCompare(right.scopeId ?? "");
  if (scopeOrder !== 0) {
    return scopeOrder;
  }
  const uriOrder = (left.uri ?? "").localeCompare(right.uri ?? "");
  if (uriOrder !== 0) {
    return uriOrder;
  }
  return left.message.localeCompare(right.message);
}

export function sortSourceIndexDiagnostics(
  diagnostics: SourceIndexDiagnostic[],
): SourceIndexDiagnostic[] {
  return [...diagnostics].sort(compareSourceIndexDiagnostics);
}

export function mergeSourceIndexDiagnostics(
  ...groups: SourceIndexDiagnostic[][]
): SourceIndexDiagnostic[] {
  const merged = new Map<string, SourceIndexDiagnostic>();
  for (const group of groups) {
    for (const diagnostic of group) {
      const key = `${diagnostic.level}\0${diagnostic.code}\0${diagnostic.scopeId ?? ""}\0${diagnostic.uri ?? ""}\0${diagnostic.message}`;
      if (!merged.has(key)) {
        merged.set(key, diagnostic);
      }
    }
  }
  return sortSourceIndexDiagnostics([...merged.values()]);
}
