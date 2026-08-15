import type { NuxtRouteSegment } from "@a11yst/types";

export function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

export function parseUrlSegment(segment: string): NuxtRouteSegment | undefined {
  const optional = segment.match(/^\[\[([^\]]+)\]\]$/);
  if (optional) {
    return { kind: "optional", name: optional[1]! };
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

export function parseDirectorySegments(segments: string[]): {
  routeSegments: NuxtRouteSegment[];
  routeGroupNames: string[];
} {
  const routeSegments: NuxtRouteSegment[] = [];
  const routeGroupNames: string[] = [];

  for (const segment of segments) {
    if (isRouteGroup(segment)) {
      routeGroupNames.push(segment.slice(1, -1));
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
  };
}

export function segmentsToRoutePattern(segments: NuxtRouteSegment[]): string {
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
    return `[[${segment.name}]]`;
  });
  return `/${parts.join("/")}`;
}

export function findNuxt4PageRootIndex(parts: string[]): number | undefined {
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (parts[index] === "app" && parts[index + 1] === "pages") {
      return index;
    }
  }
  return undefined;
}

export function findNuxt3PageRootIndex(parts: string[]): number | undefined {
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index] === "pages") {
      return index;
    }
  }
  return undefined;
}

export function findNuxt4AppShell(parts: string[]): string | undefined {
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (parts[index] === "app" && parts[index + 1] === "app.vue") {
      return parts.slice(0, index + 2).join("/");
    }
  }
  return undefined;
}

export function findNuxt3AppShell(parts: string[]): string | undefined {
  const index = parts.lastIndexOf("app.vue");
  if (index >= 0 && parts[index - 1] !== "pages" && parts[index - 1] !== "layouts") {
    return parts.slice(0, index + 1).join("/");
  }
  return undefined;
}

export function layoutNameFromUri(uri: string): string | undefined {
  const base = uri.slice(uri.lastIndexOf("/") + 1);
  if (!base.endsWith(".vue")) {
    return undefined;
  }
  const name = base.replace(/\.vue$/, "");
  if (name === "default") {
    return "default";
  }
  return name;
}
