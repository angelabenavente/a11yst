import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResolvedWebProject, RouteDiscoveryResult, SupportLevel, WebFramework } from "@a11yst/types";
import type { AdapterContext } from "./types.js";

export function readPackageJson(projectRoot: string): object | undefined {
  try {
    const raw = readFileSync(join(projectRoot, "package.json"), "utf8");
    return JSON.parse(raw) as object;
  } catch {
    return undefined;
  }
}

export const GENERIC_WEB_FRAMEWORKS: readonly WebFramework[] = [
  "svelte",
  "sveltekit",
  "astro",
  "preact",
  "solid",
  "qwik",
  "ember",
  "lit",
  "unknown",
];

export const GENERIC_SUPPORT_LEVELS: Readonly<Partial<Record<WebFramework, SupportLevel>>> = {
  svelte: "preview",
  sveltekit: "preview",
  astro: "runtime-compatible",
  preact: "runtime-compatible",
  solid: "runtime-compatible",
  qwik: "runtime-compatible",
  ember: "runtime-compatible",
  lit: "runtime-compatible",
  unknown: "unknown",
};

export function fallbackRootRoute(
  code: string,
  message: string,
  hint?: string,
): RouteDiscoveryResult {
  return {
    routes: [
      {
        id: "root",
        name: "Home",
        path: "/",
        origin: "adapter-default",
        dynamic: false,
      },
    ],
    skippedPatterns: [],
    diagnostics: [{ code, severity: "info", message, hint }],
  };
}

export function emptyDiscovery(): RouteDiscoveryResult {
  return { routes: [], skippedPatterns: [], diagnostics: [] };
}

export function createAdapterContext(
  projectRoot: string,
  configDir: string,
  project: ResolvedWebProject,
): AdapterContext {
  return {
    projectRoot,
    configDir,
    project,
    packageJson: readPackageJson(projectRoot),
  };
}
