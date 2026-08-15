const UNIX_ABSOLUTE = /^\//;
const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/;
const UNC_PATH = /^\\\\/;
const FILE_URI = /^file:/i;
const HTTP_URI = /^https?:\/\//i;
const NULL_BYTE = /\0/;

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}
const HOME_LIKE = /^(~\/|(?:\/Users\/|\/home\/|\/var\/(?:root|www)\/))/i;
const WINDOWS_USERS = /^[A-Za-z]:\/Users\//i;

export class UnsafeSourceUriError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`Unsafe or invalid source URI: ${reason}`);
    this.name = "UnsafeSourceUriError";
    this.reason = reason;
  }
}

/**
 * Normalizes a repository-relative source URI or throws when unsafe.
 */
export function normalizeSourceUri(uri: string): string {
  if (typeof uri !== "string") {
    throw new UnsafeSourceUriError("uri must be a string");
  }

  const trimmed = uri.trim();
  if (!trimmed) {
    throw new UnsafeSourceUriError("empty path");
  }

  if (NULL_BYTE.test(trimmed)) {
    throw new UnsafeSourceUriError("null byte");
  }

  if (hasControlCharacters(trimmed)) {
    throw new UnsafeSourceUriError("control characters");
  }

  const forward = trimmed.replace(/\\/g, "/");

  if (UNIX_ABSOLUTE.test(forward)) {
    throw new UnsafeSourceUriError("unix absolute path");
  }

  if (WINDOWS_ABSOLUTE.test(forward)) {
    throw new UnsafeSourceUriError("windows absolute path");
  }

  if (UNC_PATH.test(trimmed)) {
    throw new UnsafeSourceUriError("unc path");
  }

  if (FILE_URI.test(forward)) {
    throw new UnsafeSourceUriError("file url");
  }

  if (HTTP_URI.test(forward)) {
    throw new UnsafeSourceUriError("http url");
  }

  if (HOME_LIKE.test(forward)) {
    throw new UnsafeSourceUriError("home-like absolute path");
  }

  if (WINDOWS_USERS.test(forward)) {
    throw new UnsafeSourceUriError("windows user profile path");
  }

  const segments = forward.split("/");
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (resolved.length === 0) {
        throw new UnsafeSourceUriError("path traversal");
      }
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  if (resolved.length === 0) {
    throw new UnsafeSourceUriError("empty path after normalization");
  }

  return resolved.join("/");
}

/**
 * Returns true when a string looks like an unsafe absolute path for signal values.
 */
export function isUnsafeAbsolutePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  const forward = trimmed.replace(/\\/g, "/");
  return (
    UNIX_ABSOLUTE.test(forward) ||
    WINDOWS_ABSOLUTE.test(trimmed) ||
    UNC_PATH.test(trimmed) ||
    FILE_URI.test(forward) ||
    HTTP_URI.test(forward) ||
    HOME_LIKE.test(forward) ||
    WINDOWS_USERS.test(forward)
  );
}
