import { NuxtSourceValidationError } from "./errors.js";
import { DEFAULT_MAX_FILES_PER_ROUTE, DEFAULT_MAX_ROUTES, MAX_ROUTE_LENGTH } from "./constants.js";

export function sortStringArray(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function resolveNuxtCatalogOptions(
  options: { maxRoutes?: number; maxFilesPerRoute?: number } = {},
) {
  return {
    maxRoutes: assertPositiveInteger(options.maxRoutes ?? DEFAULT_MAX_ROUTES, "maxRoutes"),
    maxFilesPerRoute: assertPositiveInteger(
      options.maxFilesPerRoute ?? DEFAULT_MAX_FILES_PER_ROUTE,
      "maxFilesPerRoute",
    ),
  };
}

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new NuxtSourceValidationError(
      `${label} must be a positive integer`,
      "invalid-nuxt-mapping-evidence",
    );
  }
  return value;
}

export function stripControlCharacters(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0x1f && code !== 0x7f) {
      result += value[index];
    }
  }
  return result;
}

export function normalizeNuxtRoutePath(route: string): string | undefined {
  const trimmed = stripControlCharacters(route).trim();
  if (!trimmed || trimmed.length > MAX_ROUTE_LENGTH) {
    return undefined;
  }
  if (trimmed.includes("\0")) {
    return undefined;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return undefined;
  }

  let pathOnly = trimmed.split(/[?#]/, 1)[0] ?? "";
  pathOnly = pathOnly.replace(/\\/g, "/");
  if (!pathOnly.startsWith("/")) {
    pathOnly = `/${pathOnly}`;
  }
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) {
    pathOnly = pathOnly.slice(0, -1);
  }
  if (pathOnly.includes("..")) {
    return undefined;
  }
  const segments = pathOnly === "/" ? [] : pathOnly.slice(1).split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return undefined;
  }
  return pathOnly;
}

export function isNuxtScopeFile(frameworks: string[] | undefined): boolean {
  return frameworks?.includes("nuxt") ?? false;
}

export function basename(uri: string): string {
  const index = uri.lastIndexOf("/");
  return index >= 0 ? uri.slice(index + 1) : uri;
}

export function dirname(uri: string): string {
  const index = uri.lastIndexOf("/");
  return index >= 0 ? uri.slice(0, index) : "";
}

export function stripBoundarySuffix(name: string): { base: string; boundary?: "client" | "server" } {
  if (name.endsWith(".client.vue")) {
    return { base: name.slice(0, -".client.vue".length) + ".vue", boundary: "client" };
  }
  if (name.endsWith(".server.vue")) {
    return { base: name.slice(0, -".server.vue".length) + ".vue", boundary: "server" };
  }
  return { base: name };
}
