import type { NextRouteSegment } from "@a11yst/types";

export type RouteSpecificity = {
  staticCount: number;
  dynamicCount: number;
  catchAllCount: number;
  optionalCatchAllCount: number;
  totalSegments: number;
};

export function routeSpecificity(segments: NextRouteSegment[]): RouteSpecificity {
  const result: RouteSpecificity = {
    staticCount: 0,
    dynamicCount: 0,
    catchAllCount: 0,
    optionalCatchAllCount: 0,
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
      result.optionalCatchAllCount += 1;
    }
  }
  return result;
}

export function compareRouteSpecificity(left: RouteSpecificity, right: RouteSpecificity): number {
  if (left.staticCount !== right.staticCount) {
    return left.staticCount - right.staticCount;
  }
  if (left.dynamicCount !== right.dynamicCount) {
    return right.dynamicCount - left.dynamicCount;
  }
  if (left.catchAllCount !== right.catchAllCount) {
    return right.catchAllCount - left.catchAllCount;
  }
  if (left.optionalCatchAllCount !== right.optionalCatchAllCount) {
    return right.optionalCatchAllCount - left.optionalCatchAllCount;
  }
  return left.totalSegments - right.totalSegments;
}

function matchSegment(pattern: NextRouteSegment, value: string | undefined): boolean {
  if (value === undefined) {
    return pattern.kind === "optional-catch-all";
  }
  if (pattern.kind === "static") {
    return pattern.value === value;
  }
  if (pattern.kind === "dynamic") {
    return value.length > 0;
  }
  if (pattern.kind === "catch-all") {
    return value.length > 0;
  }
  return true;
}

export function matchPathToPattern(
  pathSegments: string[],
  patternSegments: NextRouteSegment[],
): boolean {
  let pathIndex = 0;

  for (let patternIndex = 0; patternIndex < patternSegments.length; patternIndex += 1) {
    const pattern = patternSegments[patternIndex]!;
    const remainingPatterns = patternSegments.length - patternIndex - 1;

    if (pattern.kind === "catch-all" || pattern.kind === "optional-catch-all") {
      if (pattern.kind === "catch-all" && pathIndex >= pathSegments.length) {
        return false;
      }
      if (remainingPatterns === 0) {
        return pattern.kind === "optional-catch-all" || pathIndex < pathSegments.length;
      }
      for (let start = pathIndex; start <= pathSegments.length; start += 1) {
        if (
          matchPathToPattern(pathSegments.slice(start), patternSegments.slice(patternIndex + 1))
        ) {
          if (pattern.kind === "catch-all" && start === pathIndex) {
            continue;
          }
          return true;
        }
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
