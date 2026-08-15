import type { Diagnostic, ResolvedWebProject } from "@a11yst/types";
import type { AdapterContext, FrameworkAdapter, RouteDiscoveryResult } from "./types.js";
import { emptyDiscovery, fallbackRootRoute } from "./shared.js";
import { discoverReactRoutes } from "./routes/react-discovery.js";
import { reactReadiness } from "./readiness/resolve.js";
import { recommendDevServerFromScripts } from "./utils/dev-server.js";

export const reactAdapter: FrameworkAdapter = {
  id: "react",
  framework: "react",
  supportLevel: "first-class",

  appliesTo(project: ResolvedWebProject): boolean {
    return project.framework === "react";
  },

  recommendDevServer(context: AdapterContext) {
    return recommendDevServerFromScripts(context, "react");
  },

  async discoverRoutes(context: AdapterContext): Promise<RouteDiscoveryResult> {
    if (context.project.routes.length > 0) {
      return emptyDiscovery();
    }

    const discovery = discoverReactRoutes(context.projectRoot, context.packageJson);
    const hasAuditableRoutes =
      discovery.routes.length > 0 || discovery.skippedPatterns.length > 0;

    if (hasAuditableRoutes) {
      return discovery;
    }

    const fallback = fallbackRootRoute(
      "REACT_ROUTES_EXPLICIT_RECOMMENDED",
      "No React Router routes could be discovered from source.",
      "Configure routes explicitly in a11yst.config.ts or add static React Router path definitions.",
    );

    return {
      ...fallback,
      explain: {
        strategy: discovery.explain?.strategy ?? "adapter fallback",
        routerDetected: discovery.explain?.routerDetected ?? false,
        routerEvidence: discovery.explain?.routerEvidence ?? [],
        fallbackUsed: true,
        fallbackReason: "no auditable routes discovered or configured",
        unresolved: discovery.explain?.unresolved ?? [],
      },
      diagnostics: [...discovery.diagnostics, ...(fallback.diagnostics ?? [])],
    };
  },

  getReadinessStrategy(context: AdapterContext) {
    return reactReadiness(context);
  },

  async getDiagnostics(context: AdapterContext): Promise<Diagnostic[]> {
    const discovery = await this.discoverRoutes(context);
    return discovery.diagnostics;
  },
};
