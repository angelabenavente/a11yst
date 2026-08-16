import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectProject } from "@a11yst/detect";
import {
  createAdapterContext,
  recommendDevServer,
  resolveAdapter,
} from "@a11yst/adapters";
import {
  DEFAULT_DEV_SERVER_REUSE,
  DEFAULT_DEV_SERVER_TIMEOUT,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_PROFILES,
  DEFAULT_ROOT_DIR,
  DEFAULT_WEB_VIEWPORT,
  normalizeProfileEntries,
} from "@a11yst/config";
import type {
  AccessibilityProfile,
  AdapterId,
  Platform,
  ProjectDetectionResult,
  ViewportConfig,
  WebFramework,
} from "@a11yst/types";
import { productMetadata } from "@a11yst/types";
import { formatLabelValue } from "../output.js";

const WEB_FRAMEWORKS: readonly WebFramework[] = [
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
];

export interface InitOptions {
  cwd: string;
  force: boolean;
  /** Target platform. When omitted, detection decides. Web only. */
  platform?: Platform;
  /** Framework hint. When omitted, detection decides. */
  framework?: WebFramework;
  /** Web-only base URL override. */
  baseUrl?: string;
  /** Web-only dev server command override. */
  devCommand?: string;
  /** Whether the caller intends to render JSON output. Unused internally. */
  json?: boolean;
}

export interface ResolvedInitValues {
  name: string;
  platform: Platform;
  framework: WebFramework;
  outputDir: string;
  rootDir: string;
  profiles: AccessibilityProfile[];
  baseUrl?: string;
  routes?: string[];
  viewports?: ViewportConfig[];
  routeDiscovery?: {
    mode: "off" | "fallback" | "merge";
    samples?: Record<string, string[]>;
  };
  devServer?: {
    command?: string;
    url?: string;
    reuseExisting: boolean;
    startupTimeout: number;
  };
}

export interface InitResult {
  path: string;
  source: string;
  detection: ProjectDetectionResult;
  reviewNotes: string[];
  overrides: Record<string, string>;
}

export function configFilePath(cwd: string): string {
  return join(cwd, `${productMetadata.command}.config.ts`);
}

export function assertCanWriteConfig(cwd: string, force: boolean): string {
  const target = configFilePath(cwd);
  if (existsSync(target) && !force) {
    throw new Error(
      `Configuration already exists at ${target}. Re-run with --force to overwrite.`,
    );
  }
  return target;
}

const CONFIDENT_LEVELS = new Set(["certain", "high", "medium"]);

export function parseInitPlatform(value: string): Platform {
  if (value !== "web") {
    throw new Error(`Invalid platform "${value}". Use "web".`);
  }
  return "web";
}

export function parseInitFramework(value: string): WebFramework {
  if (!WEB_FRAMEWORKS.includes(value as WebFramework)) {
    throw new Error(
      `Invalid framework "${value}". Use a web framework such as html, react, next, vue, nuxt, or angular.`,
    );
  }
  return value as WebFramework;
}

function isIdentifierKey(key: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

function formatKey(key: string): string {
  return isIdentifierKey(key) ? key : JSON.stringify(key);
}

function formatNumber(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) >= 1000 && value % 1000 === 0) {
    const sign = value < 0 ? "-" : "";
    const digits = String(Math.abs(value));
    return `${sign}${digits.slice(0, -3)}_${digits.slice(-3)}`;
  }
  return String(value);
}

function serializeValue(value: unknown, level: number): string {
  const pad = "  ".repeat(level);
  const childPad = "  ".repeat(level + 1);

  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return formatNumber(value);
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((item) => `${childPad}${serializeValue(item, level + 1)}`);
    return `[\n${items.join(",\n")},\n${pad}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) {
      return "{}";
    }
    const lines = entries.map(
      ([key, v]) => `${childPad}${formatKey(key)}: ${serializeValue(v, level + 1)},`,
    );
    return `{\n${lines.join("\n")}\n${pad}}`;
  }
  return JSON.stringify(value);
}

/**
 * Build TypeScript source for an `a11yst.config.ts` file from already
 * resolved values (see {@link runInit} for how those are decided).
 */
export function buildInitConfigSource(values: ResolvedInitValues): string {
  const project: Record<string, unknown> = {
    name: values.name,
    platform: values.platform,
    framework: values.framework,
    rootDir: values.rootDir,
    baseUrl: values.baseUrl,
  };

  if (values.devServer) {
    project.devServer = values.devServer;
  }
  if (values.routeDiscovery) {
    project.routeDiscovery = values.routeDiscovery;
  }
  if (values.routes !== undefined) {
    project.routes = values.routes;
  }
  project.profiles = values.profiles;
  project.viewports = values.viewports ?? [{ ...DEFAULT_WEB_VIEWPORT }];

  const config = {
    outputDir: values.outputDir,
    projects: [project],
  };

  return `import { defineConfig } from "@a11yst/config";

export default defineConfig(${serializeValue(config, 0)});
`;
}

/**
 * Generate and write a starter `a11yst.config.ts`, using `@a11yst/detect`
 * to fill in platform, framework, and dev-server values whenever the
 * caller hasn't explicitly provided them.
 *
 * Precedence per value: explicit flag > confident detection
 * (certain/high/medium) > conservative default (with a review note).
 */
export async function runInit(options: InitOptions): Promise<InitResult> {
  const target = assertCanWriteConfig(options.cwd, options.force);
  const detection = await detectProject({ cwd: options.cwd });

  const reviewNotes: string[] = [];
  const overrides: Record<string, string> = {};
  const detectedFramework = detection.project.framework;
  const confident = CONFIDENT_LEVELS.has(detectedFramework.confidence);

  let platform: Platform;
  if (options.platform) {
    platform = options.platform;
    overrides.platform = "flag";
  } else if (confident && detectedFramework.platform === "web") {
    platform = "web";
    overrides.platform = `detected (confidence: ${detectedFramework.confidence})`;
  } else {
    platform = "web";
    overrides.platform = "default";
    reviewNotes.push(
      'Platform could not be confidently detected; defaulted to "web". Pass --platform to override.',
    );
  }

  let framework: WebFramework;
  if (options.framework) {
    framework = options.framework;
    overrides.framework = "flag";
  } else if (confident && detectedFramework.framework !== "unknown") {
    framework = detectedFramework.framework;
    overrides.framework = `detected (confidence: ${detectedFramework.confidence})`;
  } else {
    framework = "unknown";
    overrides.framework = "default";
    reviewNotes.push(
      `Framework could not be confidently detected (confidence: ${detectedFramework.confidence}); defaulted to "unknown". Set framework once known.`,
    );
  }

  const values: ResolvedInitValues = {
    name: detection.project.name || "website",
    platform,
    framework,
    outputDir: DEFAULT_OUTPUT_DIR,
    rootDir: DEFAULT_ROOT_DIR,
    profiles: [...DEFAULT_PROFILES],
  };

  const resolvedAdapter = resolveAdapter({ framework, platform: "web" });
  const adapterContext = createAdapterContext(options.cwd, options.cwd, {
    name: values.name,
    rootDir: values.rootDir,
    platform: "web",
    framework,
    adapterId: (resolvedAdapter?.id ?? "generic-web") as AdapterId,
    baseUrl: "http://localhost:3000",
    routes: [],
    routeDiscovery: { mode: "fallback", include: [], exclude: [], samples: {} },
    readiness: { waitUntil: "domcontentloaded" },
    profiles: values.profiles,
    profileOptions: normalizeProfileEntries(values.profiles),
    viewports: [{ ...DEFAULT_WEB_VIEWPORT }],
    flows: [],
  });

  const adapterRecommendation = recommendDevServer(framework, adapterContext);
  const bestDevServer = detection.project.devServers[0];

  if (options.baseUrl) {
    values.baseUrl = options.baseUrl;
    overrides.baseUrl = "flag";
  } else if (bestDevServer?.inferredUrl) {
    values.baseUrl = bestDevServer.inferredUrl;
    overrides.baseUrl = bestDevServer.inferredUrlSource
      ? `detected (${bestDevServer.inferredUrlSource})`
      : `detected (from "${bestDevServer.sourceScript}" script)`;
  } else if (adapterRecommendation.url) {
    values.baseUrl = adapterRecommendation.url;
    overrides.baseUrl = "adapter recommendation";
  } else {
    values.baseUrl = "http://localhost:3000";
    overrides.baseUrl = "default";
    reviewNotes.push(
      'baseUrl could not be inferred; defaulted to "http://localhost:3000". Update it to match your dev server.',
    );
  }

  let devCommand: string | undefined;
  if (options.devCommand) {
    devCommand = options.devCommand;
    overrides.devCommand = "flag";
  } else if (adapterRecommendation.command) {
    devCommand = adapterRecommendation.command;
    overrides.devCommand = "adapter recommendation";
  } else if (bestDevServer?.command) {
    devCommand = bestDevServer.command;
    overrides.devCommand = "detected";
  }

  values.viewports = [{ ...DEFAULT_WEB_VIEWPORT }];
  values.routeDiscovery = { mode: "fallback" };

  switch (framework) {
    case "next":
    case "nuxt":
      values.routeDiscovery.samples = {};
      break;
    case "react":
    case "vue":
    case "angular":
      values.routes = ["/"];
      break;
    case "html":
      // routeDiscovery fallback can supply routes; explicit routes optional.
      break;
    default:
      values.routes = ["/"];
      break;
  }

  if (devCommand) {
    values.devServer = {
      command: devCommand,
      url: values.baseUrl,
      reuseExisting: DEFAULT_DEV_SERVER_REUSE,
      startupTimeout: DEFAULT_DEV_SERVER_TIMEOUT,
    };
  }

  const source = buildInitConfigSource(values);

  mkdirSync(options.cwd, { recursive: true });
  writeFileSync(target, source, "utf8");

  return {
    path: target,
    source,
    detection,
    reviewNotes,
    overrides,
  };
}

export function formatInitHuman(result: InitResult): string {
  const framework = result.detection.project.framework;
  const lines: string[] = [`Created ${result.path}`, ""];

  lines.push(formatLabelValue("Platform", framework.platform));
  lines.push(formatLabelValue("Framework", framework.framework));
  lines.push(formatLabelValue("Confidence", framework.confidence));

  if (result.reviewNotes.length > 0) {
    lines.push("", "Needs manual review:");
    for (const note of result.reviewNotes) {
      lines.push(`- ${note}`);
    }
  }

  lines.push("", result.source.trimEnd());

  return lines.join("\n");
}

export function formatInitJson(result: InitResult): unknown {
  const framework = result.detection.project.framework;
  return {
    path: result.path,
    source: result.source,
    detection: {
      platform: framework.platform,
      framework: framework.framework,
      confidence: framework.confidence,
      supportLevel: framework.supportLevel,
      packageManager: result.detection.project.packageManager.name,
    },
    reviewNotes: result.reviewNotes,
    overrides: result.overrides,
  };
}
