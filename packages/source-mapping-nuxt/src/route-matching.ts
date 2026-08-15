import type { NuxtRouteSegment } from "@a11yst/types";

export type RouteSpecificity = {
  staticCount: number;
  dynamicCount: number;
  optionalCount: number;
  catchAllCount: number;
  totalSegments: number;
};

export function routeSpecificity(segments: NuxtRouteSegment[]): RouteSpecificity {
  const result: RouteSpecificity = {
    staticCount: 0,
    dynamicCount: 0,
    optionalCount: 0,
    catchAllCount: 0,
    totalSegments: segments.length,
  };
  for (const segment of segments) {
    if (segment.kind === "static") {
      result.staticCount += 1;
    } else if (segment.kind === "dynamic") {
      result.dynamicCount += 1;
    } else if (segment.kind === "catch-all") {
      result.catchAllCount += 1;
    } else {
      result.optionalCount += 1;
    }
  }
  return result;
}

export function compareRouteSpecificity(left: RouteSpecificity, right: RouteSpecificity): number {
  if (left.staticCount !== right.staticCount) {
    return left.staticCount - right.staticCount;
  }
  if (left.optionalCount !== right.optionalCount) {
    return right.optionalCount - left.optionalCount;
  }
  if (left.dynamicCount !== right.dynamicCount) {
    return right.dynamicCount - left.dynamicCount;
  }
  if (left.catchAllCount !== right.catchAllCount) {
    return right.catchAllCount - left.catchAllCount;
  }
  return left.totalSegments - right.totalSegments;
}

function matchSegment(pattern: NuxtRouteSegment, value: string | undefined): boolean {
  if (value === undefined) {
    return pattern.kind === "optional";
  }
  if (pattern.kind === "static") {
    return pattern.value === value;
  }
  if (pattern.kind === "dynamic" || pattern.kind === "optional") {
    return value.length > 0;
  }
  if (pattern.kind === "catch-all") {
    return value.length > 0;
  }
  return true;
}

export function matchPathToPattern(
  pathSegments: string[],
  patternSegments: NuxtRouteSegment[],
): boolean {
  let pathIndex = 0;

  for (let patternIndex = 0; patternIndex < patternSegments.length; patternIndex += 1) {
    const pattern = patternSegments[patternIndex]!;
    const remainingPatterns = patternSegments.length - patternIndex - 1;

    if (pattern.kind === "catch-all") {
      if (pathIndex >= pathSegments.length) {
        return false;
      }
      if (remainingPatterns === 0) {
        return pathIndex < pathSegments.length;
      }
      for (let start = pathIndex + 1; start <= pathSegments.length; start += 1) {
        if (matchPathToPattern(pathSegments.slice(start), patternSegments.slice(patternIndex + 1))) {
          return true;
        }
      }
      return false;
    }

    if (pattern.kind === "optional") {
      if (remainingPatterns === 0) {
        const remaining = pathSegments.length - pathIndex;
        return remaining === 0 || remaining === 1;
      }
      if (
        matchPathToPattern(pathSegments.slice(pathIndex), patternSegments.slice(patternIndex + 1))
      ) {
        return true;
      }
      if (
        pathIndex < pathSegments.length &&
        matchPathToPattern(pathSegments.slice(pathIndex + 1), patternSegments.slice(patternIndex + 1))
      ) {
        return true;
      }
      return false;
    }

    if (!matchSegment(pattern, pathSegments[pathIndex])) {
      return false;
    }
    pathIndex += 1;
  }

  return pathIndex === pathSegments.length;
}

export function pathSegmentsFromRoute(route: string): string[] {
  return route === "/" ? [] : route.slice(1).split("/");
}
