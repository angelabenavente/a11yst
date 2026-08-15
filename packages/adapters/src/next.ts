import { join } from "node:path";
import type { Diagnostic, ResolvedWebProject } from "@a11yst/types";
import type { AdapterContext, FrameworkAdapter, RouteDiscoveryResult } from "./types.js";
import {
  discoverNextRoutesFromPaths,
  mergeAppAndPagesRoutes,
} from "./routes/next-discovery.js";
import { walkFiles } from "./utils/fs-walk.js";
import { makeDiscoveredRoute } from "./utils/routes.js";
import { nextReadiness } from "./readiness/resolve.js";
import { recommendDevServerFromScripts } from "./utils/dev-server.js";

export const nextAdapter: FrameworkAdapter = {
  id: "next",
  framework: "next",
  supportLevel: "first-class",

  appliesTo(project: ResolvedWebProject): boolean {
    return project.framework === "next";
  },

  recommendDevServer(context: AdapterContext) {
    return recommendDevServerFromScripts(context, "next");
  },

  async discoverRoutes(context: AdapterContext): Promise<RouteDiscoveryResult> {
    const entries = walkFiles(context.projectRoot, { maxDepth: 8 });
    const relativePaths = entries
      .filter((entry) => !entry.isDirectory)
      .map((entry) => entry.relativePath);

    const { appRoutes, pagesRoutes, skippedPatterns } =
      discoverNextRoutesFromPaths({ relativePaths });
    const merged = mergeAppAndPagesRoutes(appRoutes, pagesRoutes);
    const diagnostics: Diagnostic[] = [];

    if (merged.collisions.length > 0) {
      diagnostics.push({
        code: "NEXT_ROUTE_COLLISION",
        severity: "warning",
        message: `App and Pages routers both define routes for: ${merged.collisions.join(", ")}.`,
        hint: "Prefer one router or list explicit routes in a11yst.config.ts.",
        path: join(context.projectRoot),
      });
    }

    if (appRoutes.length > 0 && pagesRoutes.length > 0) {
      diagnostics.push({
        code: "NEXT_HYBRID_ROUTER",
        severity: "info",
        message: "Both App Router and Pages Router routes were discovered.",
        path: join(context.projectRoot),
      });
    }

    const routes = merged.routes.map((route) =>
      makeDiscoveredRoute(route.path, "filesystem", {
        pattern: route.pattern,
        sourceFile: route.sourceFile,
      }),
    );

    return { routes, skippedPatterns, diagnostics };
  },

  getReadinessStrategy(context: AdapterContext) {
    return nextReadiness(context);
  },

  async getDiagnostics(context: AdapterContext): Promise<Diagnostic[]> {
    const discovery = await this.discoverRoutes(context);
    return discovery.diagnostics;
  },
};

