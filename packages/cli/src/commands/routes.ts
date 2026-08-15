import { resolveProjectPath, loadConfig } from "@a11yst/config";
import {
  createAdapterContext,
  resolveAdapter,
  resolveProjectRoutes,
} from "@a11yst/adapters";
import type {
  AdapterId,
  Diagnostic,
  ResolvedWebProject,
  RouteDiscoveryExplain,
  RouteDiscoveryMode,
  RouteOrigin,
  SkippedRoutePattern,
  WebFramework,
} from "@a11yst/types";
import { formatLabelValue } from "../output.js";

export interface RoutesRouteEntry {
  path: string;
  origin: RouteOrigin;
  sourceFile?: string;
  sourceLine?: number;
  pattern?: string;
}

export interface RoutesProjectResult {
  name: string;
  framework: WebFramework;
  adapterId: AdapterId;
  discoveryMode: RouteDiscoveryMode;
  routes: RoutesRouteEntry[];
  skippedPatterns: SkippedRoutePattern[];
  diagnostics: Diagnostic[];
  explain?: RouteDiscoveryExplain;
  explicitRoutes: RoutesRouteEntry[];
}

export interface RoutesResult {
  projects: RoutesProjectResult[];
}

export interface RunRoutesOptions {
  cwd: string;
  projectName?: string[];
  configPath?: string;
  json?: boolean;
  explain?: boolean;
}

export async function runRoutes(options: RunRoutesOptions): Promise<RoutesResult> {
  const config = await loadConfig({
    cwd: options.cwd,
    configPath: options.configPath,
  });

  const filter = options.projectName?.length
    ? new Set(options.projectName)
    : undefined;

  const projects: RoutesProjectResult[] = [];

  for (const project of config.projects) {
    if (project.platform !== "web") {
      continue;
    }
    if (filter && !filter.has(project.name)) {
      continue;
    }

    projects.push(await resolveProjectRoutesResult(project, config.configDir));
  }

  if (filter) {
    const found = new Set(projects.map((entry) => entry.name));
    const missing = options.projectName!.filter((name) => !found.has(name));
    if (missing.length > 0) {
      throw new Error(
        `Unknown project name(s): ${missing.join(", ")}. Configured: ${config.projects
          .map((entry) => entry.name)
          .join(", ")}.`,
      );
    }
  }

  return { projects };
}

async function resolveProjectRoutesResult(
  project: ResolvedWebProject,
  configDir: string,
): Promise<RoutesProjectResult> {
  const projectRoot = resolveProjectPath(configDir, project.rootDir);
  const adapter =
    resolveAdapter({ framework: project.framework, platform: project.platform }) ??
    resolveAdapter({ framework: "unknown", platform: "web" });

  if (!adapter) {
    throw new Error(`No adapter available for web project "${project.name}".`);
  }

  const context = createAdapterContext(projectRoot, configDir, project);
  const discovery = await adapter.discoverRoutes(context);
  const adapterDiagnostics = await adapter.getDiagnostics(context);
  const merged = resolveProjectRoutes({
    explicitRoutes: project.routes,
    discovery,
    mode: project.routeDiscovery.mode,
    samples: project.routeDiscovery.samples,
  });

  const diagnostics = dedupeDiagnostics([...merged.diagnostics, ...adapterDiagnostics]);

  const explain = discovery.explain
    ? {
        ...discovery.explain,
        fallbackUsed:
          discovery.explain.fallbackUsed ||
          merged.routes.some((route) => route.origin === "adapter-default"),
      }
    : undefined;

  return {
    name: project.name,
    framework: project.framework,
    adapterId: adapter.id as AdapterId,
    discoveryMode: project.routeDiscovery.mode,
    routes: merged.routes.map((route) => ({
      path: route.path,
      origin: route.origin ?? "explicit",
      ...(route.sourceFile !== undefined ? { sourceFile: route.sourceFile } : {}),
      ...(route.sourceLine !== undefined ? { sourceLine: route.sourceLine } : {}),
      ...(route.pattern !== undefined ? { pattern: route.pattern } : {}),
    })),
    skippedPatterns: merged.skippedPatterns,
    diagnostics,
    explain,
    explicitRoutes: project.routes.map((route) => ({
      path: route.path,
      origin: "explicit" as const,
    })),
  };
}

function dedupeDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  const result: Diagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.code}:${diagnostic.message}:${diagnostic.path ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(diagnostic);
  }
  return result;
}

function formatRouteOriginLabel(origin: RouteOrigin): string {
  switch (origin) {
    case "react-jsx-route":
    case "react-router-object":
      return "react-router";
    case "filesystem":
      return "filesystem";
    case "explicit":
      return "explicit";
    case "adapter-default":
      return "fallback";
    case "dynamic-sample":
      return "dynamic-sample";
    default:
      return origin;
  }
}

function formatRouteSource(route: RoutesRouteEntry): string | undefined {
  if (!route.sourceFile) {
    return undefined;
  }
  if (route.sourceLine !== undefined) {
    return `${route.sourceFile}:${route.sourceLine}`;
  }
  return route.sourceFile;
}

export function formatRoutesJson(result: RoutesResult): unknown {
  return result;
}

export function formatRoutesHuman(result: RoutesResult, options: { explain?: boolean } = {}): string {
  if (result.projects.length === 0) {
    return "No web projects matched the current filters.";
  }

  const lines: string[] = ["Resolved routes", ""];

  for (const project of result.projects) {
    lines.push(project.name);
    lines.push(formatLabelValue("Framework", project.framework));
    lines.push(formatLabelValue("Adapter", project.adapterId));
    lines.push(formatLabelValue("Discovery", project.discoveryMode));

    if (options.explain) {
      lines.push("");
      lines.push("Explain:");
      lines.push(formatLabelValue("Strategy", project.explain?.strategy ?? "unknown"));
      lines.push(
        formatLabelValue(
          "Router detected",
          project.explain?.routerDetected ? "yes" : "no",
        ),
      );
      if (project.explain?.routerEvidence.length) {
        lines.push("Router evidence:");
        for (const evidence of project.explain.routerEvidence) {
          lines.push(`  - ${evidence}`);
        }
      }
    }

    lines.push("");

    if (project.routes.length === 0) {
      lines.push("  (no routes resolved)");
    } else {
      lines.push("Routes:");
      for (const route of project.routes) {
        const label = formatRouteOriginLabel(route.origin);
        const source = formatRouteSource(route);
        const suffix = [label, source ? `from ${source}` : undefined]
          .filter(Boolean)
          .join(", ");
        lines.push(`  ✓ ${route.path}${suffix ? `  ${suffix}` : ""}`);
      }
    }

    if (project.skippedPatterns.length > 0) {
      lines.push("");
      if (options.explain) {
        lines.push("Unresolved:");
      } else {
        lines.push("Skipped dynamic patterns:");
      }
      for (const skipped of project.skippedPatterns) {
        const source = skipped.sourceFile
          ? skipped.sourceLine !== undefined
            ? `${skipped.sourceFile}:${skipped.sourceLine}`
            : skipped.sourceFile
          : undefined;
        lines.push(
          `  ! ${skipped.pattern}  ${skipped.reason}${source ? ` (${source})` : ""}`,
        );
      }
    }

    if (options.explain && project.explicitRoutes.length > 0) {
      lines.push("");
      lines.push("Explicit:");
      for (const route of project.explicitRoutes) {
        lines.push(`  ${route.path}`);
      }
    }

    if (options.explain) {
      lines.push("");
      lines.push(
        formatLabelValue(
          "Fallback",
          project.explain?.fallbackUsed
            ? `yes — ${project.explain.fallbackReason ?? "adapter default route"}`
            : "no",
        ),
      );
    }

    if (project.diagnostics.length > 0) {
      lines.push("");
      lines.push("Diagnostics:");
      for (const diagnostic of project.diagnostics) {
        lines.push(`  [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
        if (diagnostic.hint) {
          lines.push(`    Hint: ${diagnostic.hint}`);
        }
      }
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
