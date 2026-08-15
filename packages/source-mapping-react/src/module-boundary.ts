export type ModuleBoundary = "client" | "server" | "unknown";

function stripLeadingComments(source: string): string {
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("//", index)) {
      const lineEnd = source.indexOf("\n", index);
      index = lineEnd === -1 ? source.length : lineEnd + 1;
      continue;
    }
    if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    break;
  }
  return source.slice(index).trimStart();
}

function hasTopLevelDirective(source: string, directive: "use client" | "use server"): boolean {
  const trimmed = stripLeadingComments(source);
  const patterns = [
    new RegExp(`^["']${directive}["']\\s*;`),
    new RegExp(`^;\\s*["']${directive}["']\\s*;`),
  ];
  return patterns.some((pattern) => pattern.test(trimmed));
}

function isAppRouterUri(uri: string): boolean {
  return /(?:^|\/)app\//.test(uri);
}

function isPagesRouterUri(uri: string): boolean {
  return /(?:^|\/)pages\//.test(uri);
}

export function detectModuleBoundary(uri: string, source: string): ModuleBoundary {
  if (isPagesRouterUri(uri)) {
    return "unknown";
  }
  if (!isAppRouterUri(uri)) {
    return "unknown";
  }
  if (hasTopLevelDirective(source, "use client")) {
    return "client";
  }
  if (hasTopLevelDirective(source, "use server")) {
    return "server";
  }
  return "server";
}
