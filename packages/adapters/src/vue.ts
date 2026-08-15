import type { Diagnostic, ResolvedWebProject } from "@a11yst/types";
import type { AdapterContext, FrameworkAdapter, RouteDiscoveryResult } from "./types.js";
import { fallbackRootRoute } from "./shared.js";
import { vueReadiness } from "./readiness/resolve.js";
import { recommendDevServerFromScripts } from "./utils/dev-server.js";

export const vueAdapter: FrameworkAdapter = {
  id: "vue",
  framework: "vue",
  supportLevel: "first-class",

  appliesTo(project: ResolvedWebProject): boolean {
    return project.framework === "vue";
  },

  recommendDevServer(context: AdapterContext) {
    return recommendDevServerFromScripts(context, "vue");
  },

  async discoverRoutes(context: AdapterContext): Promise<RouteDiscoveryResult> {
    if (context.project.routes.length > 0) {
      return { routes: [], skippedPatterns: [], diagnostics: [] };
    }
    return fallbackRootRoute(
      "VUE_ROUTES_EXPLICIT_RECOMMENDED",
      "Vue projects do not support filesystem route discovery in this phase.",
      "Configure vue-router paths explicitly in a11yst.config.ts.",
    );
  },

  getReadinessStrategy(context: AdapterContext) {
    return vueReadiness(context);
  },

  async getDiagnostics(context: AdapterContext): Promise<Diagnostic[]> {
    const discovery = await this.discoverRoutes(context);
    return discovery.diagnostics;
  },
};
