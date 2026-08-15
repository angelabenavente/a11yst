import type { NextRouteSegment } from "@a11yst/types";
import { INTERCEPTING_PREFIXES } from "./constants.js";

export type ParsedAppPath = {
  routeSegments: NextRouteSegment[];
  routeGroupNames: string[];
  parallelSlot?: string;
  isPrivate: boolean;
  isIntercepting: boolean;
};

export function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")") && !isInterceptingSegment(segment);
}

export function isParallelSlot(segment: string): boolean {
  return segment.startsWith("@");
}

export function isPrivateSegment(segment: string): boolean {
  return segment.startsWith("_");
}

export function isInterceptingSegment(segment: string): boolean {
  return INTERCEPTING_PREFIXES.some(
    (prefix) => segment === prefix || segment.startsWith(`${prefix}`),
  );
}

export function parseUrlSegment(segment: string): NextRouteSegment | undefined {
  const optionalCatchAll = segment.match(/^\[\[\.\.\.([^\]]+)\]\]$/);
  if (optionalCatchAll) {
    return { kind: "optional-catch-all", name: optionalCatchAll[1]! };
  }
  const catchAll = segment.match(/^\[\.\.\.([^\]]+)\]$/);
  if (catchAll) {
    return { kind: "catch-all", name: catchAll[1]! };
  }
  const dynamic = segment.match(/^\[([^\]]+)\]$/);
  if (dynamic) {
    return { kind: "dynamic", name: dynamic[1]! };
  }
  return { kind: "static", value: segment };
}

export function parseAppDirectorySegments(segments: string[]): ParsedAppPath {
  const routeSegments: NextRouteSegment[] = [];
  const routeGroupNames: string[] = [];
  let parallelSlot: string | undefined;
  let isPrivate = false;
  let isIntercepting = false;

  for (const segment of segments) {
    if (isPrivateSegment(segment)) {
      isPrivate = true;
      continue;
    }
    if (isInterceptingSegment(segment)) {
      isIntercepting = true;
      continue;
    }
    if (isRouteGroup(segment)) {
      routeGroupNames.push(segment.slice(1, -1));
      continue;
    }
    if (isParallelSlot(segment)) {
      parallelSlot = segment.slice(1);
      continue;
    }
    const parsed = parseUrlSegment(segment);
    if (parsed) {
      routeSegments.push(parsed);
    }
  }

  return {
    routeSegments,
    routeGroupNames: [...new Set(routeGroupNames)].sort((left, right) => left.localeCompare(right)),
    parallelSlot,
    isPrivate,
    isIntercepting,
  };
}

export function segmentsToRoutePattern(segments: NextRouteSegment[]): string {
  if (segments.length === 0) {
    return "/";
  }
  const parts = segments.map((segment) => {
    if (segment.kind === "static") {
      return segment.value;
    }
    if (segment.kind === "dynamic") {
      return `[${segment.name}]`;
    }
    if (segment.kind === "catch-all") {
      return `[...${segment.name}]`;
    }
    return `[[...${segment.name}]]`;
  });
  return `/${parts.join("/")}`;
}

export function findAppRootIndex(parts: string[]): number | undefined {
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index] === "app") {
      return index;
    }
  }
  return undefined;
}

export function findPagesRootIndex(parts: string[]): number | undefined {
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index] === "pages") {
      return index;
    }
  }
  return undefined;
}

export function roleFromBasename(name: string): string | undefined {
  const base = name.replace(/\.(js|jsx|tsx)$/, "");
  return base;
}
