import type { DiscoveredRoute, RouteOrigin, SkippedRoutePattern } from "@a11yst/types";

function readableSlugPart(raw: string): string {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Keep malformed percent sequences deterministic.
  }

  const readable = decoded
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (readable) return readable;

  const codePoints = Array.from(decoded, (character) =>
    character.codePointAt(0)?.toString(16),
  ).filter((value): value is string => value !== undefined);
  return codePoints.length > 0 ? `u-${codePoints.join("-")}` : "";
}

/** Generate a stable route id from a normalised path (mirrors @a11yst/config). */
export function generateRouteId(routePath: string): string {
  const hashIndex = routePath.indexOf("#");
  const beforeHash = hashIndex >= 0 ? routePath.slice(0, hashIndex) : routePath;
  const hash = hashIndex >= 0 ? routePath.slice(hashIndex + 1) : "";
  const queryIndex = beforeHash.indexOf("?");
  const pathname =
    queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "";

  const pathnameSlug = readableSlugPart(pathname);
  const parts = [pathname === "/" ? "root" : pathnameSlug || "route"];
  if (queryIndex >= 0) {
    parts.push("query", readableSlugPart(query) || "empty");
  }
  if (hashIndex >= 0) {
    parts.push("hash", readableSlugPart(hash) || "empty");
  }
  return parts.join("-");
}

export function humanizeRouteId(id: string): string {
  return id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function makeDiscoveredRoute(
  path: string,
  origin: RouteOrigin,
  options: {
    pattern?: string;
    sourceFile?: string;
    sourceLine?: number;
    dynamic?: boolean;
  } = {},
): DiscoveredRoute {
  const id = generateRouteId(path);
  return {
    id,
    name: humanizeRouteId(id),
    path,
    origin,
    dynamic: options.dynamic ?? false,
    ...(options.pattern !== undefined ? { pattern: options.pattern } : {}),
    ...(options.sourceFile !== undefined ? { sourceFile: options.sourceFile } : {}),
    ...(options.sourceLine !== undefined ? { sourceLine: options.sourceLine } : {}),
  };
}

export function skippedPattern(
  pattern: string,
  reason = "dynamic-segment",
  sourceFile?: string,
  sourceLine?: number,
): SkippedRoutePattern {
  return {
    pattern,
    reason,
    ...(sourceFile !== undefined ? { sourceFile } : {}),
    ...(sourceLine !== undefined ? { sourceLine } : {}),
  };
}
