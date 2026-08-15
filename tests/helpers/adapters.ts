import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AdapterId, ResolvedWebProject } from "@a11yst/types";
import { createAdapterContext } from "@a11yst/adapters";

export const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "../..");

const ADAPTER_BY_FRAMEWORK: Record<ResolvedWebProject["framework"], AdapterId> = {
  html: "html",
  react: "react",
  next: "next",
  angular: "angular",
  vue: "vue",
  nuxt: "nuxt",
  svelte: "generic-web",
  sveltekit: "generic-web",
  astro: "generic-web",
  preact: "generic-web",
  solid: "generic-web",
  qwik: "generic-web",
  ember: "generic-web",
  lit: "generic-web",
  unknown: "generic-web",
};

export function adapterFixture(name: string): string {
  return join(repoRoot, "tests/fixtures/adapters", name);
}

export function webProject(
  framework: ResolvedWebProject["framework"],
  overrides: Partial<ResolvedWebProject> = {},
): ResolvedWebProject {
  return {
    name: "demo",
    rootDir: ".",
    platform: "web",
    framework,
    adapterId: ADAPTER_BY_FRAMEWORK[framework],
    baseUrl: "http://localhost:3000",
    routes: [],
    routeDiscovery: {
      mode: "fallback",
      include: [],
      exclude: [],
      samples: {},
    },
    readiness: {
      waitUntil: "domcontentloaded",
    },
    profiles: ["default"],
    profileOptions: [{ id: "default" }],
    viewports: [
      {
        name: "desktop",
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        orientation: "landscape",
      },
    ],
    flows: [],
    ...overrides,
  };
}

export function adapterContext(
  fixtureName: string,
  framework: ResolvedWebProject["framework"],
  overrides: Partial<ResolvedWebProject> = {},
) {
  const projectRoot = adapterFixture(fixtureName);
  const project = webProject(framework, overrides);
  return createAdapterContext(projectRoot, projectRoot, project);
}
