import type { ResolvedWebProject, WebFramework } from "@a11yst/types";
import type { AdapterContext, FrameworkAdapter, RouteDiscoveryResult } from "./types.js";
import { fallbackRootRoute, GENERIC_SUPPORT_LEVELS } from "./shared.js";
import { genericBodyReadiness } from "./readiness/resolve.js";
import { recommendDevServerFromScripts } from "./utils/dev-server.js";

function createGenericWebAdapter(): FrameworkAdapter {
  return {
    id: "generic-web",
    framework: "unknown",
    supportLevel: "unknown",

    appliesTo(project: ResolvedWebProject): boolean {
      return project.platform === "web";
    },

    recommendDevServer(context: AdapterContext) {
      return recommendDevServerFromScripts(context, context.project.framework);
    },

    async discoverRoutes(context: AdapterContext): Promise<RouteDiscoveryResult> {
      if (context.project.routes.length > 0) {
        return { routes: [], skippedPatterns: [], diagnostics: [] };
      }
      return fallbackRootRoute(
        "GENERIC_WEB_ROUTES_EXPLICIT_RECOMMENDED",
        `Framework "${context.project.framework}" has no filesystem route discovery.`,
        "List routes explicitly in a11yst.config.ts.",
      );
    },

    getReadinessStrategy(context: AdapterContext) {
      return genericBodyReadiness(context);
    },

    async getDiagnostics(context: AdapterContext) {
      const discovery = await this.discoverRoutes(context);
      return discovery.diagnostics;
    },
  };
}

export const genericWebAdapter = createGenericWebAdapter();

export function bindGenericWebAdapter(
  framework: WebFramework,
): FrameworkAdapter {
  const supportLevel = GENERIC_SUPPORT_LEVELS[framework] ?? "unknown";
  return {
    ...genericWebAdapter,
    framework,
    supportLevel,
    appliesTo(project: ResolvedWebProject): boolean {
      return project.framework === framework;
    },
  };
}

export { GENERIC_WEB_FRAMEWORKS, GENERIC_SUPPORT_LEVELS } from "./shared.js";
