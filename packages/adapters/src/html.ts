import type { Diagnostic, ResolvedWebProject } from "@a11yst/types";
import type { AdapterContext, FrameworkAdapter, RouteDiscoveryResult } from "./types.js";
import { discoverHtmlRoutes } from "./routes/html-discovery.js";
import { htmlReadiness } from "./readiness/resolve.js";
import { recommendDevServerFromScripts } from "./utils/dev-server.js";

export const htmlAdapter: FrameworkAdapter = {
  id: "html",
  framework: "html",
  supportLevel: "first-class",

  appliesTo(project: ResolvedWebProject): boolean {
    return project.framework === "html";
  },

  recommendDevServer(context: AdapterContext) {
    return recommendDevServerFromScripts(context, "html");
  },

  async discoverRoutes(context: AdapterContext): Promise<RouteDiscoveryResult> {
    return discoverHtmlRoutes(context.projectRoot);
  },

  getReadinessStrategy(context: AdapterContext) {
    return htmlReadiness(context);
  },

  async getDiagnostics(context: AdapterContext): Promise<Diagnostic[]> {
    const result = await this.discoverRoutes(context);
    if (result.routes.length === 0) {
      return [
        {
          code: "HTML_NO_ROUTES_DISCOVERED",
          severity: "info",
          message: "No .html files were discovered under the project root.",
          hint: "Add explicit routes in a11yst.config.ts or ensure HTML entry files exist.",
        },
      ];
    }
    return [];
  },
};
