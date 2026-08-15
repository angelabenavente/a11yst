/**
 * Normalise a web route path.
 * Ensures a leading slash and collapses empty segments.
 */
export function normalizeRoutePath(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new Error("Route path must not be empty.");
  }
  const absoluteUrl = /^[a-z][a-z\d+.-]*:/i.test(trimmed);
  if (!trimmed.startsWith("/") && !absoluteUrl) {
    return `/${trimmed}`;
  }
  if (absoluteUrl) {
    throw new Error(
      `Route must be a path (starting with "/"), not an absolute URL: ${trimmed}`,
    );
  }
  // Collapse duplicate slashes except we only have a path
  const collapsed = trimmed.replace(/\/{2,}/g, "/");
  return collapsed === "" ? "/" : collapsed;
}

function readableSlugPart(raw: string): string {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Keep malformed percent sequences deterministic and let slugging encode them.
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

/**
 * Generate a stable, portable route id from a normalised route path.
 * Query and hash components are labelled so they remain deterministic.
 */
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

/** Turn a route id into a concise default report label. */
export function humanizeRouteId(id: string): string {
  return id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

/**
 * Ensure a base URL is absolute and has no trailing slash (except origin root).
 */
export function normalizeBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `baseUrl must be an absolute URL (received "${raw}"). Example: http://localhost:3000`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `baseUrl must use http or https (received "${parsed.protocol}").`,
    );
  }
  // Remove trailing slash for consistent joining, keep origin form
  const href = parsed.href.endsWith("/")
    ? parsed.href.slice(0, -1)
    : parsed.href;
  return href;
}
