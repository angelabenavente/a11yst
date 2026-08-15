import { z } from "zod";
import type {
  AdapterId,
  Diagnostic,
  NormalizedRoute,
  NormalizedViewport,
  ResolvedConfig,
  ResolvedDevServer,
  ResolvedProject,
  ResolvedReadinessConfig,
  ResolvedRouteDiscoveryConfig,
  ResolvedWebProject,
  WebFramework,
  ProfileConfigEntry,
} from "@a11yst/types";
import {
  DEFAULT_CI_POLICY,
  DEFAULT_DEV_SERVER_REUSE,
  DEFAULT_DEV_SERVER_TIMEOUT,
  DEFAULT_EVIDENCE,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_READINESS,
  DEFAULT_ROOT_DIR,
  DEFAULT_ROUTE_DISCOVERY,
  DEFAULT_SOURCE_ANALYSIS,
  DEFAULT_WEB_VIEWPORT,
} from "./defaults.js";
import { ConfigError, type ConfigIssue } from "./errors.js";
import {
  normalizeProfileEntries,
  profileIdsFromOptions,
} from "./profiles.js";
import { FlowConfigError, normalizeProjectFlows } from "@a11yst/flows";
import type { FlowConfig } from "@a11yst/types";
import { resolve as resolvePath } from "node:path";
import {
  generateRouteId,
  humanizeRouteId,
  normalizeBaseUrl,
  normalizeRoutePath,
} from "./normalize.js";

const accessibilityProfileSchema = z.enum([
  "default",
  "keyboard",
  "large-text",
  "reduced-motion",
]);

const webFrameworkSchema = z.enum([
  "html",
  "react",
  "next",
  "angular",
  "vue",
  "nuxt",
  "svelte",
  "sveltekit",
  "astro",
  "preact",
  "solid",
  "qwik",
  "ember",
  "lit",
  "unknown",
]);

const viewportSchema = z.object({
  name: z.string().min(1, "Viewport name must not be empty."),
  width: z
    .number({ invalid_type_error: "Viewport width must be a number." })
    .int("Viewport width must be an integer.")
    .positive("Viewport width must be a positive integer."),
  height: z
    .number({ invalid_type_error: "Viewport height must be a number." })
    .int("Viewport height must be an integer.")
    .positive("Viewport height must be a positive integer."),
  deviceScaleFactor: z
    .number({ invalid_type_error: "deviceScaleFactor must be a number." })
    .finite("deviceScaleFactor must be finite.")
    .positive("deviceScaleFactor must be greater than 0.")
    .max(10, "deviceScaleFactor must be at most 10.")
    .optional(),
  isMobile: z.boolean().optional(),
  hasTouch: z.boolean().optional(),
  orientation: z.enum(["portrait", "landscape"]).optional(),
});

const routeObjectSchema = z.object({
  id: z
    .string()
    .min(1, "Route id must not be empty.")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Route id may contain only letters, numbers, hyphens, and underscores.",
    )
    .optional(),
  path: z.string().min(1, "Route path must not be empty."),
  name: z.string().min(1).optional(),
});

const routeSchema = z.union([
  z.string().min(1, "Route path must not be empty."),
  routeObjectSchema,
]);

const devServerSchema = z
  .object({
    command: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
    reuseExisting: z.boolean().optional(),
    startupTimeout: z
      .number()
      .int()
      .positive("startupTimeout must be a positive integer (ms).")
      .optional(),
  })
  .strict();

function hasPathTraversal(value: string): boolean {
  return value.split(/[/\\]/).some((segment) => segment === "..");
}

const routeDiscoverySchema = z
  .object({
    mode: z.enum(["off", "fallback", "merge"]).optional(),
    include: z.array(z.string().min(1, "Include patterns must not be empty.")).optional(),
    exclude: z.array(z.string().min(1, "Exclude patterns must not be empty.")).optional(),
    samples: z
      .record(
        z.string().min(1, "Sample route pattern keys must not be empty."),
        z
          .array(z.string().min(1, "Sample paths must not be empty."))
          .min(1, "Each sample pattern requires at least one sample path."),
      )
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.samples) return;

    for (const [pattern, samplePaths] of Object.entries(value.samples)) {
      samplePaths.forEach((samplePath, index) => {
        if (hasPathTraversal(samplePath)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["samples", pattern, index],
            message: "Sample paths must not contain path traversal segments (..).",
          });
        }
      });
    }
  });

const readinessSchema = z
  .object({
    waitUntil: z.enum(["domcontentloaded", "load"]).optional(),
    selector: z.string().min(1, "Readiness selector must not be empty.").optional(),
    timeout: z
      .number()
      .int("Readiness timeout must be an integer.")
      .positive("Readiness timeout must be a positive integer (ms).")
      .optional(),
    settleFrames: z
      .number()
      .int("settleFrames must be an integer.")
      .nonnegative("settleFrames must be zero or greater.")
      .optional(),
  })
  .strict();

const webProjectRoutesRefine = (
  value: {
    routes?: Array<string | z.infer<typeof routeObjectSchema>>;
    routeDiscovery?: z.infer<typeof routeDiscoverySchema>;
  },
  ctx: z.RefinementCtx,
): void => {
  const mode = value.routeDiscovery?.mode ?? DEFAULT_ROUTE_DISCOVERY.mode;
  const routeCount = value.routes?.length ?? 0;

  if (mode === "off" && routeCount < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["routes"],
      message:
        'Web projects require at least one route when routeDiscovery.mode is "off".',
    });
  }
};

const profileEntrySchema = z.union([
  accessibilityProfileSchema,
  z.object({
    id: z.literal("default"),
  }),
  z.object({
    id: z.literal("keyboard"),
    maxTabStops: z.number().int().positive().max(500).optional(),
    detectFocusTraps: z.boolean().optional(),
    captureFocusEvidence: z.boolean().optional(),
  }),
  z.object({
    id: z.literal("large-text"),
    textScale: z.number().positive().max(4).optional(),
    detectHorizontalOverflow: z.boolean().optional(),
    compareWithDefault: z.boolean().optional(),
    overlapTolerancePx: z.number().int().nonnegative().max(100).optional(),
  }),
  z.object({
    id: z.literal("reduced-motion"),
    emulatePreference: z.boolean().optional(),
    inspectAnimations: z.boolean().optional(),
    minimumSignificantDurationMs: z.number().int().positive().max(10_000).optional(),
    compareWithDefault: z.boolean().optional(),
  }),
]);

const flowStepSchema = z
  .object({
    action: z.string().min(1),
  })
  .passthrough();

const flowSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    start: z.string().min(1),
    profiles: z.array(profileEntrySchema).min(1).optional(),
    viewports: z.array(z.string().min(1)).min(1).optional(),
    storageState: z.string().min(1).optional(),
    allowOrigins: z.array(z.string().url()).optional(),
    stepTimeout: z.number().int().positive().optional(),
    navigationTimeout: z.number().int().positive().optional(),
    steps: z.array(flowStepSchema).min(1),
  })
  .strict();

const projectBaseSchema = z.object({
  name: z.string().min(1, "Project name must not be empty."),
  rootDir: z.string().min(1).optional(),
  profiles: z.array(profileEntrySchema).min(1).optional(),
});

const webProjectObjectSchema = projectBaseSchema.extend({
  platform: z.literal("web"),
  framework: webFrameworkSchema.optional(),
  baseUrl: z.string().min(1).optional(),
  devServer: devServerSchema.optional(),
  routes: z.array(routeSchema).optional(),
  routeDiscovery: routeDiscoverySchema.optional(),
  readiness: readinessSchema.optional(),
  viewports: z.array(viewportSchema).min(1).optional(),
  flows: z.array(flowSchema).optional(),
});

const webProjectBaseUrlRefine = (
  value: z.infer<typeof webProjectObjectSchema>,
  ctx: z.RefinementCtx,
): void => {
  if (!value.baseUrl && !value.devServer?.url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["baseUrl"],
      message:
        "Web projects require baseUrl or devServer.url (an http(s) origin).",
    });
  }
};

/** Standalone web project schema (includes baseUrl refinement). */
const webProjectInputSchema = webProjectObjectSchema
  .superRefine(webProjectBaseUrlRefine)
  .superRefine(webProjectRoutesRefine);

const projectInputSchema = webProjectInputSchema;

const baselineConfigSchema = z
  .object({
    file: z.string().min(1).optional(),
    compare: z.boolean().optional(),
    classifications: z.boolean().optional(),
  })
  .strict();

const severitySchema = z.enum(["minor", "medium", "high", "critical"]);

const ciPolicySchema = z
  .object({
    failOnNew: z.boolean().optional(),
    failOnRegression: z.boolean().optional(),
    failOnExpiredClassification: z.boolean().optional(),
    minimumSeverity: severitySchema.optional(),
  })
  .strict();

const sarifReportConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    output: z.string().min(1).optional(),
  })
  .strict();

const junitReportConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    output: z.string().min(1).optional(),
  })
  .strict();

const markdownReportConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    output: z.string().min(1).optional(),
  })
  .strict();

const githubAnnotationsReportConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    output: z.string().min(1).optional(),
  })
  .strict();

const reportsConfigSchema = z
  .object({
    html: z.boolean().optional(),
    sarif: z.union([z.boolean(), sarifReportConfigSchema]).optional(),
    junit: z.union([z.boolean(), junitReportConfigSchema]).optional(),
    markdown: z.union([z.boolean(), markdownReportConfigSchema]).optional(),
    githubAnnotations: z
      .union([z.boolean(), githubAnnotationsReportConfigSchema])
      .optional(),
    githubStepSummary: z.boolean().optional(),
  })
  .strict();

const sourceAnalysisConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    ranking: z.boolean().optional(),
    recommendations: z.boolean().optional(),
  })
  .strict();

const configInputSchema = z.object({
  outputDir: z.string().min(1).optional(),
  reports: reportsConfigSchema.optional(),
  evidence: z
    .object({
      screenshots: z.boolean().optional(),
      fullPage: z.boolean().optional(),
    })
    .strict()
    .optional(),
  baseline: baselineConfigSchema.optional(),
  ci: ciPolicySchema.optional(),
  sourceAnalysis: sourceAnalysisConfigSchema.optional(),
  projects: z
    .array(projectInputSchema)
    .min(1, "Configuration must include at least one project."),
});

function zodIssuesToConfigIssues(error: z.ZodError): ConfigIssue[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    let hint: string | undefined;

    if (path.includes("baseUrl") || path.includes("devServer.url")) {
      hint =
        'Add a baseUrl or devServer.url such as "http://localhost:3000" for web projects.';
    } else if (path.includes("routes")) {
      hint =
        'Provide at least one route path like "/" or "/about", or set routeDiscovery.mode to "fallback" or "merge".';
    } else if (path.includes("routeDiscovery")) {
      hint =
        'Use routeDiscovery.mode "fallback" or "merge" to discover routes, or set mode to "off" and provide explicit routes.';
    } else if (path.includes("readiness")) {
      hint =
        'Use readiness.waitUntil "domcontentloaded" or "load", and optional selector, timeout, or settleFrames.';
    } else if (path.includes("viewports")) {
      hint =
        "Viewport width and height must be positive integers (e.g. width: 1440, height: 900).";
    } else if (path.includes("platform")) {
      hint = 'Use platform "web".';
    }

    return { path, message: issue.message, hint };
  });
}

function resolveRoute(
  raw: string | { id?: string; path: string; name?: string },
): NormalizedRoute {
  const rawPath = typeof raw === "string" ? raw : raw.path;
  if (rawPath.trim().startsWith("//")) {
    throw new Error(
      `Route must not be a protocol-relative URL: ${rawPath.trim()}`,
    );
  }
  const path = normalizeRoutePath(rawPath);
  const explicitId = typeof raw === "string" ? undefined : raw.id;
  const id = explicitId ?? generateRouteId(path);
  const explicitName = typeof raw === "string" ? undefined : raw.name;
  const name =
    explicitName ?? (path === "/" ? "Home" : humanizeRouteId(id));
  return { id, name, path };
}

function ensureUniqueRouteIds(
  routes: NormalizedRoute[],
  projectName: string,
): void {
  const seen = new Map<string, number>();
  for (const [index, route] of routes.entries()) {
    const firstIndex = seen.get(route.id);
    if (firstIndex !== undefined) {
      throw new ConfigError({
        code: "DUPLICATE_ROUTE_ID",
        message: `Duplicate route id "${route.id}" in web project "${projectName}".`,
        path: `projects.${projectName}.routes[${index}].id`,
        hint: `Route IDs must be unique within a web project. The first occurrence is routes[${firstIndex}].`,
      });
    }
    seen.set(route.id, index);
  }
}

function resolveViewport(
  viewport: z.infer<typeof viewportSchema>,
): NormalizedViewport {
  return {
    name: viewport.name,
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
    isMobile: viewport.isMobile ?? false,
    hasTouch: viewport.hasTouch ?? false,
    orientation:
      viewport.orientation ??
      (viewport.width >= viewport.height ? "landscape" : "portrait"),
  };
}

function resolveDevServer(
  input: z.infer<typeof devServerSchema> | undefined,
  projectName: string,
  diagnostics: Diagnostic[],
): ResolvedDevServer | undefined {
  if (!input) return undefined;

  const resolved: ResolvedDevServer = {
    reuseExisting: input.reuseExisting ?? DEFAULT_DEV_SERVER_REUSE,
    startupTimeout: input.startupTimeout ?? DEFAULT_DEV_SERVER_TIMEOUT,
  };

  if (input.command) {
    resolved.command = input.command;
  }

  if (input.url) {
    try {
      resolved.url = normalizeBaseUrl(input.url);
    } catch (error) {
      throw new ConfigError({
        code: "INVALID_DEV_SERVER_URL",
        message: error instanceof Error ? error.message : String(error),
        path: `projects.${projectName}.devServer.url`,
        hint: 'Use an absolute http(s) URL, for example "http://localhost:3000".',
      });
    }
  }

  if (!resolved.command && !resolved.url) {
    diagnostics.push({
      code: "EMPTY_DEV_SERVER",
      severity: "info",
      message: `Project "${projectName}" declares an empty devServer block.`,
      hint: "Provide command and/or url, or omit devServer entirely.",
      path: `projects.${projectName}.devServer`,
    });
    return undefined;
  }

  return resolved;
}

function resolveRouteDiscovery(
  input: z.infer<typeof routeDiscoverySchema> | undefined,
): ResolvedRouteDiscoveryConfig {
  return {
    mode: input?.mode ?? DEFAULT_ROUTE_DISCOVERY.mode,
    include: input?.include ? [...input.include] : [...DEFAULT_ROUTE_DISCOVERY.include],
    exclude: input?.exclude ? [...input.exclude] : [...DEFAULT_ROUTE_DISCOVERY.exclude],
    samples: input?.samples ? structuredClone(input.samples) : { ...DEFAULT_ROUTE_DISCOVERY.samples },
  };
}

function resolveReadiness(
  input: z.infer<typeof readinessSchema> | undefined,
): ResolvedReadinessConfig {
  const resolved: ResolvedReadinessConfig = {
    waitUntil: input?.waitUntil ?? DEFAULT_READINESS.waitUntil,
  };

  if (input?.selector) {
    resolved.selector = input.selector;
  }
  if (input?.timeout !== undefined) {
    resolved.timeout = input.timeout;
  }
  if (input?.settleFrames !== undefined) {
    resolved.settleFrames = input.settleFrames;
  }

  return resolved;
}

function resolveAdapterId(framework: WebFramework): AdapterId {
  switch (framework) {
    case "html":
      return "html";
    case "react":
      return "react";
    case "next":
      return "next";
    case "angular":
      return "angular";
    case "vue":
      return "vue";
    case "nuxt":
      return "nuxt";
    default:
      return "generic-web";
  }
}

function resolveWebProject(
  input: z.infer<typeof webProjectInputSchema>,
  diagnostics: Diagnostic[],
  configDir: string,
): ResolvedWebProject {
  const rootDir = input.rootDir ?? DEFAULT_ROOT_DIR;
  const devServer = resolveDevServer(input.devServer, input.name, diagnostics);

  const rawBase = input.baseUrl ?? input.devServer?.url;
  if (!rawBase) {
    throw new ConfigError({
      code: "INVALID_BASE_URL",
      message: `Web project "${input.name}" is missing baseUrl and devServer.url.`,
      path: `projects.${input.name}.baseUrl`,
      hint: 'Add a baseUrl such as "http://localhost:3000".',
    });
  }

  let baseUrl: string;
  try {
    baseUrl = normalizeBaseUrl(rawBase);
  } catch (error) {
    throw new ConfigError({
      code: "INVALID_BASE_URL",
      message: error instanceof Error ? error.message : String(error),
      path: `projects.${input.name}.baseUrl`,
      hint: 'Use an absolute http(s) URL, for example "http://localhost:3000".',
    });
  }

  if (input.baseUrl && input.devServer?.url) {
    let normalizedDevUrl: string | undefined;
    try {
      normalizedDevUrl = normalizeBaseUrl(input.devServer.url);
    } catch {
      normalizedDevUrl = undefined;
    }
    if (normalizedDevUrl && normalizedDevUrl !== baseUrl) {
      diagnostics.push({
        code: "BASE_URL_DEV_SERVER_MISMATCH",
        severity: "warning",
        message: `Project "${input.name}" has differing baseUrl (${baseUrl}) and devServer.url (${normalizedDevUrl}). Planning uses baseUrl.`,
        hint: "Align both values, or keep only one source of truth.",
        path: `projects.${input.name}`,
      });
    }
  }

  // Keep resolved.devServer.url aligned with the planning origin when only one was provided.
  if (devServer && !devServer.url) {
    devServer.url = baseUrl;
  }

  let routes: NormalizedRoute[];
  try {
    routes = (input.routes ?? []).map(resolveRoute);
  } catch (error) {
    throw new ConfigError({
      code: "INVALID_ROUTE",
      message: error instanceof Error ? error.message : String(error),
      path: `projects.${input.name}.routes`,
      hint: 'Routes must be paths starting with "/", not absolute URLs.',
    });
  }
  ensureUniqueRouteIds(routes, input.name);

  const viewports: NormalizedViewport[] =
    input.viewports && input.viewports.length > 0
      ? input.viewports.map(resolveViewport)
      : [{ ...DEFAULT_WEB_VIEWPORT }];

  const profileOptions = normalizeProfileEntries(input.profiles);
  const profiles = profileIdsFromOptions(profileOptions);

  const framework = (input.framework ?? "unknown") as WebFramework;

  let flows;
  try {
    flows = normalizeProjectFlows(input.flows as FlowConfig[] | undefined, {
      projectName: input.name,
      projectProfileOptions: profileOptions,
      projectViewports: viewports,
      projectRootDir: resolvePath(configDir, rootDir),
      baseOrigin: baseUrl,
      flowProfileResolver: (flow) =>
        flow.profiles
          ? normalizeProfileEntries(flow.profiles as ProfileConfigEntry[])
          : profileOptions,
    });
  } catch (error) {
    throw new ConfigError({
      code: "INVALID_FLOW",
      message: error instanceof FlowConfigError ? error.message : String(error),
      path: `projects.${input.name}.flows`,
      hint: "Ensure each flow has a unique id, valid start path, steps, and at least one checkpoint.",
    });
  }

  const resolved: ResolvedWebProject = {
    name: input.name,
    rootDir,
    platform: "web",
    framework,
    adapterId: resolveAdapterId(framework),
    baseUrl,
    routes,
    routeDiscovery: resolveRouteDiscovery(input.routeDiscovery),
    readiness: resolveReadiness(input.readiness),
    profiles,
    profileOptions,
    viewports,
    flows,
  };

  if (devServer) {
    resolved.devServer = devServer;
  }

  return resolved;
}

function ensureUniqueProjectNames(projects: ResolvedProject[]): void {
  const seen = new Map<string, number>();
  for (const [index, project] of projects.entries()) {
    if (seen.has(project.name)) {
      throw new ConfigError({
        code: "DUPLICATE_PROJECT_NAME",
        message: `Duplicate project name "${project.name}".`,
        path: `projects[${index}].name`,
        hint: "Each project.name must be unique within a11yst.config.ts.",
      });
    }
    seen.set(project.name, index);
  }
}

/**
 * Validate and normalise a raw configuration object.
 */
export function validateConfig(
  input: unknown,
  options: { configDir?: string; configPath?: string } = {},
): ResolvedConfig {
  const parsed = configInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ConfigError({
      code: "INVALID_CONFIG",
      message: "Configuration is invalid.",
      path: options.configPath,
      hint:
        "Run `a11yst init` to create a starter config, or fix the issues listed below.",
      issues: zodIssuesToConfigIssues(parsed.error),
    });
  }

  const diagnostics: Diagnostic[] = [];

  const projects: ResolvedProject[] = parsed.data.projects.map((project) =>
    resolveWebProject(project, diagnostics, options.configDir ?? process.cwd()),
  );

  ensureUniqueProjectNames(projects);

  const reportsInput = parsed.data.reports;
  let sarifEnabled = false;
  let sarifOutput: string | undefined;
  if (typeof reportsInput?.sarif === "boolean") {
    sarifEnabled = reportsInput.sarif;
  } else if (reportsInput?.sarif) {
    sarifEnabled = reportsInput.sarif.enabled ?? false;
    sarifOutput = reportsInput.sarif.output;
  }

  let junitEnabled = false;
  let junitOutput: string | undefined;
  if (typeof reportsInput?.junit === "boolean") {
    junitEnabled = reportsInput.junit;
  } else if (reportsInput?.junit) {
    junitEnabled = reportsInput.junit.enabled ?? false;
    junitOutput = reportsInput.junit.output;
  }

  let markdownEnabled = true;
  let markdownOutput: string | undefined;
  if (typeof reportsInput?.markdown === "boolean") {
    markdownEnabled = reportsInput.markdown;
  } else if (reportsInput?.markdown) {
    markdownEnabled = reportsInput.markdown.enabled ?? true;
    markdownOutput = reportsInput.markdown.output;
  }

  let githubAnnotationsEnabled = false;
  let githubAnnotationsOutput: string | undefined;
  if (typeof reportsInput?.githubAnnotations === "boolean") {
    githubAnnotationsEnabled = reportsInput.githubAnnotations;
  } else if (reportsInput?.githubAnnotations) {
    githubAnnotationsEnabled = reportsInput.githubAnnotations.enabled ?? false;
    githubAnnotationsOutput = reportsInput.githubAnnotations.output;
  }

  const githubStepSummaryEnabled = reportsInput?.githubStepSummary ?? false;

  return {
    outputDir: parsed.data.outputDir ?? DEFAULT_OUTPUT_DIR,
    reports: {
      html: reportsInput?.html ?? true,
      sarif: sarifEnabled,
      ...(sarifOutput ? { sarifOutput } : {}),
      junit: junitEnabled,
      ...(junitOutput ? { junitOutput } : {}),
      markdown: markdownEnabled,
      ...(markdownOutput ? { markdownOutput } : {}),
      githubAnnotations: githubAnnotationsEnabled,
      ...(githubAnnotationsOutput ? { githubAnnotationsOutput } : {}),
      githubStepSummary: githubStepSummaryEnabled,
    },
    evidence: {
      screenshots:
        parsed.data.evidence?.screenshots ?? DEFAULT_EVIDENCE.screenshots,
      fullPage: parsed.data.evidence?.fullPage ?? DEFAULT_EVIDENCE.fullPage,
    },
    baseline: {
      file: parsed.data.baseline?.file ?? ".a11yst/baseline.json",
      compare: parsed.data.baseline?.compare ?? true,
      classifications: parsed.data.baseline?.classifications ?? true,
    },
    ci: {
      failOnNew: parsed.data.ci?.failOnNew ?? DEFAULT_CI_POLICY.failOnNew,
      failOnRegression: parsed.data.ci?.failOnRegression ?? DEFAULT_CI_POLICY.failOnRegression,
      failOnExpiredClassification:
        parsed.data.ci?.failOnExpiredClassification ??
        DEFAULT_CI_POLICY.failOnExpiredClassification,
      minimumSeverity: parsed.data.ci?.minimumSeverity ?? DEFAULT_CI_POLICY.minimumSeverity,
    },
    sourceAnalysis: {
      enabled: parsed.data.sourceAnalysis?.enabled ?? DEFAULT_SOURCE_ANALYSIS.enabled,
      ranking: parsed.data.sourceAnalysis?.ranking ?? DEFAULT_SOURCE_ANALYSIS.ranking,
      recommendations:
        parsed.data.sourceAnalysis?.recommendations ?? DEFAULT_SOURCE_ANALYSIS.recommendations,
    },
    projects,
    configDir: options.configDir ?? process.cwd(),
    configPath: options.configPath ?? "",
    diagnostics,
  };
}

export {
  accessibilityProfileSchema,
  configInputSchema,
  readinessSchema,
  routeDiscoverySchema,
  webFrameworkSchema,
  webProjectInputSchema,
};
