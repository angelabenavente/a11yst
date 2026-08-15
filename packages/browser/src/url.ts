/**
 * Join a project base URL with a route path into a single navigable URL.
 *
 * Rules:
 * - A trailing slash on `baseUrl` and/or a leading slash on `routePath` never
 *   produce a double slash in the path.
 * - Query strings and hash fragments on `routePath` are preserved as-is.
 * - If `routePath` is itself an absolute `http(s)://` URL it fully replaces
 *   `baseUrl` (rare, but useful for cross-origin smoke checks).
 * - `baseUrl`'s origin (protocol/host/port) is never altered — only its path
 *   is combined with `routePath`.
 *
 * Throws a clear `Error` when `baseUrl` is not a valid absolute URL.
 */
export function buildPageUrl(baseUrl: string, routePath: string): string {
  if (/^https?:\/\//i.test(routePath)) {
    try {
      return new URL(routePath).toString();
    } catch (error) {
      throw new Error(
        `Invalid absolute route URL "${routePath}": ${(error as Error).message}`,
      );
    }
  }

  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch (error) {
    throw new Error(
      `Invalid base URL "${baseUrl}": ${(error as Error).message}`,
    );
  }

  const [routePathname = "", routeRest = ""] = splitPathFromQueryOrHash(routePath);

  const basePath =
    base.pathname === "/" ? "" : base.pathname.replace(/\/+$/, "");
  const normalizedRoutePath = routePathname.startsWith("/")
    ? routePathname
    : routePathname.length > 0
      ? `/${routePathname}`
      : "";

  const combinedPath = `${basePath}${normalizedRoutePath}` || "/";

  return `${base.origin}${combinedPath}${routeRest}`;
}

/**
 * Split a route string into its pathname and its trailing query/hash suffix.
 * `/foo/bar?a=1#top` -> ["/foo/bar", "?a=1#top"]
 */
function splitPathFromQueryOrHash(routePath: string): [string, string] {
  const match = /^([^?#]*)([?#].*)?$/.exec(routePath);
  if (!match) {
    return [routePath, ""];
  }
  return [match[1] ?? "", match[2] ?? ""];
}
