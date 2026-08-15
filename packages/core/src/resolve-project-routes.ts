import { resolve } from "node:path";
import {
  createAdapterContext,
  resolveAdapter,
  resolveProjectRoutes,
} from "@a11yst/adapters";
import type {
  Diagnostic,
  NormalizedRoute,
  ProgressReporter,
  ResolvedConfig,
  ResolvedWebProject,
  SkippedRoutePattern,
} from "@a11yst/types";

export interface ResolveProjectRoutesForProjectResult {
  routes: NormalizedRoute[];
  diagnostics: Diagnostic[];
}

function skippedPatternDiagnostics(
  skippedPatterns: SkippedRoutePattern[],
  projectName: string,
): Diagnostic[] {
  return skippedPatterns.map((entry) => ({
    code: "ROUTE_PATTERN_SKIPPED",
    severity: "info",
    message: `Route pattern "${entry.pattern}" was skipped: ${entry.reason}`,
    path: `projects.${projectName}.routeDiscovery`,
    ...(entry.sourceFile !== undefined ? { hint: entry.sourceFile } : {}),
  }));
}

/**
 * Resolve routes for one web project using the framework adapter and route
 * discovery settings. Explicit config routes are always preserved; discovery
 * supplements or replaces them according to `routeDiscovery.mode`.
 */
export async function resolveProjectRoutesForProject(
  project: ResolvedWebProject,
  configDir: string,
): Promise<ResolveProjectRoutesForProjectResult> {
  const mode = project.routeDiscovery.mode;

  if (mode === "off") {
    return {
      routes: project.routes.map((route) => ({ ...route })),
      diagnostics: [],
    };
  }

  if (mode === "fallback" && project.routes.length > 0) {
    return {
      routes: project.routes.map((route) => ({ ...route })),
      diagnostics: [],
    };
  }

  const projectRoot = resolve(configDir, project.rootDir);
  const context = createAdapterContext(projectRoot, configDir, project);
  const adapter = resolveAdapter({
    framework: project.framework,
    platform: project.platform,
  });

  if (!adapter) {
    return {
      routes: project.routes.map((route) => ({ ...route })),
      diagnostics: [
        {
          code: "ADAPTER_NOT_FOUND",
          severity: "warning",
          message: `No adapter found for framework "${project.framework}". Using explicit routes only.`,
          path: `projects.${project.name}.framework`,
        },
      ],
    };
  }

  const discovery = await adapter.discoverRoutes(context);
  const adapterDiagnostics = await adapter.getDiagnostics(context);

  const merged = resolveProjectRoutes({
    explicitRoutes: project.routes,
    discovery,
    mode,
    samples: project.routeDiscovery.samples,
  });

  const diagnostics: Diagnostic[] = [
    ...adapterDiagnostics,
    ...merged.diagnostics,
    ...skippedPatternDiagnostics(merged.skippedPatterns, project.name),
  ];

  return {
    routes: merged.routes,
    diagnostics,
  };
}

/**
 * Resolve adapter-discovered routes for every web project and return a cloned
 * config ready for synchronous planning via {@link createAuditPlan}.
 */
export async function prepareAuditConfig(
  config: ResolvedConfig,
  progress?: ProgressReporter,
): Promise<ResolvedConfig> {
  progress?.start("Discovering routes…");
  const diagnostics = [...config.diagnostics];
  let routeCount = 0;
  const projects = await Promise.all(
    config.projects.map(async (project) => {
      if (project.platform !== "web") {
        return structuredClone(project);
      }

      const resolved = await resolveProjectRoutesForProject(project, config.configDir);
      diagnostics.push(...resolved.diagnostics);
      routeCount += resolved.routes.length;

      return {
        ...structuredClone(project),
        routes: resolved.routes,
      };
    }),
  );

  progress?.succeed(`${routeCount} route${routeCount === 1 ? "" : "s"} resolved`);

  return {
    ...structuredClone(config),
    projects,
    diagnostics,
  };
}
