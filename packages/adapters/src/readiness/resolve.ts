import type { ReadinessStrategy, AdapterContext } from "../types.js";

const DEFAULT_READINESS: ReadinessStrategy = {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
  settleFrames: 2,
};

export function resolveReadiness(
  overrides: Partial<ReadinessStrategy> = {},
): ReadinessStrategy {
  return { ...DEFAULT_READINESS, ...overrides };
}

export function genericBodyReadiness(_context: AdapterContext): ReadinessStrategy {
  return resolveReadiness({ selectors: ["body"] });
}

export function reactReadiness(_context: AdapterContext): ReadinessStrategy {
  return resolveReadiness({ selectors: ["#root", "[data-reactroot]", "body"] });
}

export function nextReadiness(_context: AdapterContext): ReadinessStrategy {
  return resolveReadiness({ selectors: ["#__next", "body"] });
}

export function angularReadiness(_context: AdapterContext): ReadinessStrategy {
  return resolveReadiness({ selectors: ["app-root", "body"] });
}

export function vueReadiness(_context: AdapterContext): ReadinessStrategy {
  return resolveReadiness({ selectors: ["#app", "[data-v-app]", "body"] });
}

export function nuxtReadiness(_context: AdapterContext): ReadinessStrategy {
  return resolveReadiness({ selectors: ["#__nuxt", "body"] });
}

export function htmlReadiness(_context: AdapterContext): ReadinessStrategy {
  return resolveReadiness({ waitUntil: "load", selectors: ["body"] });
}
