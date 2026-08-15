import type { Diagnostic, ResolvedWebProject } from "@a11yst/types";
import type { AdapterContext, FrameworkAdapter, RouteDiscoveryResult } from "./types.js";
import { discoverNuxtRoutesFromPaths } from "./routes/nuxt-discovery.js";
import { walkFiles } from "./utils/fs-walk.js";
import { makeDiscoveredRoute } from "./utils/routes.js";
import { nuxtReadiness } from "./readiness/resolve.js";
import { recommendDevServerFromScripts } from "./utils/dev-server.js";
import { fallbackRootRoute } from "./shared.js";

export const nuxtAdapter: FrameworkAdapter = {
  id: "nuxt",
  framework: "nuxt",
  supportLevel: "first-class",

  appliesTo(project: ResolvedWebProject): boolean {
    return project.framework === "nuxt";
  },

  recommendDevServer(context: AdapterContext) {
    return recommendDevServerFromScripts(context, "nuxt");
  },

  async discoverRoutes(context: AdapterContext): Promise<RouteDiscoveryResult> {
    const entries = walkFiles(context.projectRoot, { maxDepth: 8 });
    const relativePaths = entries
      .filter((entry) => !entry.isDirectory)
      .map((entry) => entry.relativePath);

    const { routes, skippedPatterns } = discoverNuxtRoutesFromPaths(relativePaths);
    if (routes.length === 0) {
      if (context.project.routes.length > 0) {
        return { routes: [], skippedPatterns, diagnostics: [] };
      }
      const fallback = fallbackRootRoute(
        "NUXT_ROUTES_FALLBACK",
        "No static Nuxt pages were discovered under pages/.",
        "Add explicit routes or provide samples for dynamic segments.",
      );
      return { ...fallback, skippedPatterns };
    }

    return {
      routes: routes.map((route) =>
        makeDiscoveredRoute(route.path, "filesystem", {
          pattern: route.pattern,
          sourceFile: route.sourceFile,
        }),
      ),
      skippedPatterns,
      diagnostics: [],
    };
  },

  getReadinessStrategy(context: AdapterContext) {
    return nuxtReadiness(context);
  },

  async getDiagnostics(context: AdapterContext): Promise<Diagnostic[]> {
    const discovery = await this.discoverRoutes(context);
    return discovery.diagnostics;
  },
};
