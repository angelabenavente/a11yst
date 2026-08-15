import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Diagnostic, ResolvedWebProject } from "@a11yst/types";
import type { AdapterContext, FrameworkAdapter, RouteDiscoveryResult } from "./types.js";
import { fallbackRootRoute } from "./shared.js";
import { angularReadiness } from "./readiness/resolve.js";
import { recommendDevServerFromScripts } from "./utils/dev-server.js";

interface AngularJsonProject {
  sourceRoot?: string;
  root?: string;
}

interface AngularJson {
  defaultProject?: string;
  projects?: Record<string, AngularJsonProject>;
}

export function readAngularJson(projectRoot: string): AngularJson | undefined {
  try {
    const raw = readFileSync(join(projectRoot, "angular.json"), "utf8");
    return JSON.parse(raw) as AngularJson;
  } catch {
    return undefined;
  }
}

export function resolveAngularSourceRoot(projectRoot: string): string | undefined {
  const angularJson = readAngularJson(projectRoot);
  if (!angularJson?.projects) {
    return undefined;
  }
  const defaultName = angularJson.defaultProject;
  const project =
    (defaultName ? angularJson.projects[defaultName] : undefined) ??
    Object.values(angularJson.projects)[0];
  return project?.sourceRoot;
}

export const angularAdapter: FrameworkAdapter = {
  id: "angular",
  framework: "angular",
  supportLevel: "first-class",

  appliesTo(project: ResolvedWebProject): boolean {
    return project.framework === "angular";
  },

  recommendDevServer(context: AdapterContext) {
    return recommendDevServerFromScripts(context, "angular");
  },

  async discoverRoutes(context: AdapterContext): Promise<RouteDiscoveryResult> {
    if (context.project.routes.length > 0) {
      return { routes: [], skippedPatterns: [], diagnostics: [] };
    }
    return fallbackRootRoute(
      "ANGULAR_ROUTES_EXPLICIT_RECOMMENDED",
      "Angular route discovery is not available in this phase.",
      "List application routes explicitly in a11yst.config.ts.",
    );
  },

  getReadinessStrategy(context: AdapterContext) {
    return angularReadiness(context);
  },

  async getDiagnostics(context: AdapterContext): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const angularJson = readAngularJson(context.projectRoot);
    if (!angularJson) {
      diagnostics.push({
        code: "ANGULAR_JSON_MISSING",
        severity: "info",
        message: "angular.json was not found or could not be parsed.",
        path: join(context.projectRoot, "angular.json"),
      });
    } else {
      const sourceRoot = resolveAngularSourceRoot(context.projectRoot);
      if (sourceRoot) {
        diagnostics.push({
          code: "ANGULAR_SOURCE_ROOT",
          severity: "info",
          message: `Default Angular sourceRoot is "${sourceRoot}".`,
          path: join(context.projectRoot, "angular.json"),
        });
      }
    }

    const routeDiagnostics = (await this.discoverRoutes(context)).diagnostics ?? [];
    diagnostics.push(...routeDiagnostics);
    return diagnostics;
  },
};
