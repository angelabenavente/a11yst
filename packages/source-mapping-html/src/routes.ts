import { normalizeSourceUri, UnsafeSourceUriError } from "@a11yst/source-mapping";

const ABSOLUTE_ROUTE = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeRoute(route: string | undefined): string | undefined {
  if (route === undefined) {
    return undefined;
  }
  const trimmed = route.trim();
  if (!trimmed) {
    return undefined;
  }
  if (ABSOLUTE_ROUTE.test(trimmed)) {
    return undefined;
  }

  let pathOnly = trimmed.split(/[?#]/)[0] ?? "";
  pathOnly = pathOnly.replace(/\\/g, "/");
  if (!pathOnly.startsWith("/")) {
    pathOnly = `/${pathOnly}`;
  }
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) {
    pathOnly = pathOnly.slice(0, -1);
  }

  try {
    const normalized = normalizeSourceUri(pathOnly.slice(1) || ".");
    if (normalized === "." || normalized.includes("..")) {
      return undefined;
    }
    return pathOnly === "/" ? "/" : `/${normalized}`;
  } catch (error) {
    if (error instanceof UnsafeSourceUriError) {
      return undefined;
    }
    throw error;
  }
}

export function routeCandidatesForUri(uri: string, route: string): boolean {
  const fileName = uri.slice(uri.lastIndexOf("/") + 1);
  const directory = uri.includes("/") ? uri.slice(0, uri.lastIndexOf("/")) : "";

  if (route === "/") {
    return fileName === "index.html" || fileName === "index.htm";
  }

  const trimmedRoute = route.startsWith("/") ? route.slice(1) : route;
  if (trimmedRoute.endsWith(".html") || trimmedRoute.endsWith(".htm")) {
    return uri === trimmedRoute || uri.endsWith(`/${trimmedRoute}`);
  }

  const direct = `${trimmedRoute}.html`;
  const nested = `${trimmedRoute}/index.html`;
  return uri === direct || uri.endsWith(`/${direct}`) || uri === nested || uri.endsWith(`/${nested}`) || directory.endsWith(trimmedRoute);
}

export function filterElementsByRoute<T extends { uri: string }>(
  elements: T[],
  route: string | undefined,
): { elements: T[]; matched: boolean } {
  if (route === undefined) {
    return { elements, matched: true };
  }
  const filtered = elements.filter((element) => routeCandidatesForUri(element.uri, route));
  return { elements: filtered, matched: filtered.length > 0 };
}

export function filterFilesByRoute<T extends { uri: string }>(
  files: T[],
  route: string | undefined,
): { files: T[]; matched: boolean } {
  if (route === undefined) {
    return { files, matched: true };
  }
  const filtered = files.filter((file) => routeCandidatesForUri(file.uri, route));
  return { files: filtered, matched: filtered.length > 0 };
}
