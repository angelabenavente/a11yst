import { accessSync, constants, existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  ConfigError,
  findConfigPath,
  loadConfig,
  resolveProjectPath,
} from "@a11yst/config";
import { detectPackageManager, detectProject, detectWorkspace, readPackageJson } from "@a11yst/detect";
import {
  createAdapterContext,
  FIRST_CLASS_ADAPTERS,
  readAngularJson,
  resolveAdapter,
} from "@a11yst/adapters";
import type { ResolvedConfig, ResolvedWebProject, WebFramework } from "@a11yst/types";
import { productMetadata } from "@a11yst/types";

export type DoctorStatus = "ok" | "warn" | "fail";

export interface DoctorCheck {
  id: string;
  title: string;
  status: DoctorStatus;
  detail: string;
  hint?: string;
}

export interface DoctorReport {
  status: DoctorStatus;
  checks: DoctorCheck[];
}

function worstStatus(statuses: DoctorStatus[]): DoctorStatus {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  return "ok";
}

function parseVersion(raw: string): number[] {
  return raw
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isNodeCompatible(current: string, minimum: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left > right) return true;
    if (left < right) return false;
  }
  return true;
}

/** Best-effort extraction of the package.json script name a dev command invokes. */
function extractScriptName(command: string): string | undefined {
  const trimmed = command.trim();
  const runMatch = /^(?:npm|bun)\s+run\s+(\S+)/.exec(trimmed);
  if (runMatch?.[1]) return runMatch[1];
  const directMatch = /^(?:pnpm|yarn)\s+(\S+)/.exec(trimmed);
  if (directMatch?.[1]) return directMatch[1];
  const parts = trimmed.split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : undefined;
}

function checkArtifactsWritable(cwd: string): DoctorCheck {
  const artifactsDir = join(cwd, ".a11yst");
  const probe = join(artifactsDir, `.doctor-write-${process.pid}`);
  try {
    mkdirSync(artifactsDir, { recursive: true });
    accessSync(artifactsDir, constants.W_OK);
    // Touch and clean a probe file under the artifacts directory.
    mkdirSync(probe, { recursive: true });
    rmSync(probe, { recursive: true, force: true });
    return {
      id: "artifacts-writable",
      title: "Artifacts directory",
      status: "ok",
      detail: `Writable artifacts directory available at ${artifactsDir}.`,
    };
  } catch (error) {
    // Fallback: try system temp to distinguish permission vs path issues
    const tempProbe = join(tmpdir(), `a11yst-doctor-${process.pid}`);
    try {
      mkdirSync(tempProbe, { recursive: true });
      rmSync(tempProbe, { recursive: true, force: true });
    } catch {
      // ignore
    }
    return {
      id: "artifacts-writable",
      title: "Artifacts directory",
      status: "fail",
      detail: `Cannot write to ${artifactsDir}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      hint: `Ensure the project directory is writable so ${productMetadata.name} can store future reports.`,
    };
  }
}

const PLAYWRIGHT_CHROMIUM_HINT =
  "Run `pnpm exec playwright install chromium` after installing @a11yst/cli.";

async function checkPlaywrightChromium(): Promise<DoctorCheck> {
  try {
    const { chromium } = await import("playwright");
    const executablePath = chromium.executablePath();
    if (existsSync(executablePath)) {
      return {
        id: "playwright-chromium",
        title: "Playwright Chromium",
        status: "ok",
        detail: `Chromium executable found at ${executablePath}.`,
      };
    }
    return {
      id: "playwright-chromium",
      title: "Playwright Chromium",
      status: "warn",
      detail: `Chromium is not installed (expected at ${executablePath}).`,
      hint: PLAYWRIGHT_CHROMIUM_HINT,
    };
  } catch (error) {
    return {
      id: "playwright-chromium",
      title: "Playwright Chromium",
      status: "warn",
      detail: `Cannot resolve Playwright Chromium: ${
        error instanceof Error ? error.message : String(error)
      }`,
      hint: PLAYWRIGHT_CHROMIUM_HINT,
    };
  }
}

function checkPackageManager(cwd: string): DoctorCheck {
  const manifest = readPackageJson(cwd);
  const detection = detectPackageManager(cwd, manifest);
  const unknown = detection.name === "unknown";
  return {
    id: "package-manager",
    title: "Package manager",
    status: unknown ? "warn" : "ok",
    detail: unknown
      ? "No lockfile or packageManager field detected."
      : `Detected package manager: ${detection.name} (confidence: ${detection.confidence}).`,
    hint: unknown ? "This is optional. A lockfile helps reproducible installs." : undefined,
  };
}

async function checkProjectsAgainstDetection(
  config: ResolvedConfig,
): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];

  for (const project of config.projects) {
    const rootAbs = resolveProjectPath(config.configDir, project.rootDir);

    if (!existsSync(rootAbs)) {
      checks.push({
        id: `project-root:${project.name}`,
        title: `Project root (${project.name})`,
        status: "fail",
        detail: `Configured rootDir "${project.rootDir}" for project "${project.name}" does not exist at ${rootAbs}.`,
        hint: "Fix rootDir in the configuration or create the missing directory.",
      });
      continue;
    }

    checks.push({
      id: `project-root:${project.name}`,
      title: `Project root (${project.name})`,
      status: "ok",
      detail: `Root directory exists at ${rootAbs}.`,
    });

    const detection = await detectProject({ cwd: rootAbs });
    const detectedFramework = detection.project.framework;

    if (detectedFramework.platform !== "unknown" && detectedFramework.platform !== project.platform) {
      checks.push({
        id: `platform-match:${project.name}`,
        title: `Platform match (${project.name})`,
        status: "fail",
        detail: `Project "${project.name}" is configured as "${project.platform}" but detection found "${detectedFramework.platform}".`,
        hint: `Update platform to "${detectedFramework.platform}", or verify rootDir points at the intended project.`,
      });
    } else {
      checks.push({
        id: `platform-match:${project.name}`,
        title: `Platform match (${project.name})`,
        status: "ok",
        detail: `Configured platform "${project.platform}" agrees with detection.`,
      });
    }

    if (detectedFramework.framework === "unknown") {
      const configuredIsUnknown = project.framework === "unknown";
      checks.push({
        id: `framework-match:${project.name}`,
        title: `Framework detection (${project.name})`,
        status: configuredIsUnknown ? "ok" : "warn",
        detail: configuredIsUnknown
          ? `No framework signals detected for "${project.name}"; framework remains "unknown".`
          : `Configured framework "${project.framework}" could not be verified: no recognizable framework signals were found at ${rootAbs}.`,
        hint: configuredIsUnknown ? undefined : "Confirm the framework value manually.",
      });
    } else if (detectedFramework.framework !== project.framework) {
      checks.push({
        id: `framework-match:${project.name}`,
        title: `Framework detection (${project.name})`,
        status: "warn",
        detail: `Project "${project.name}" is configured with framework "${project.framework}" but detection found "${detectedFramework.framework}" (confidence: ${detectedFramework.confidence}).`,
        hint: "Update the framework in the configuration if detection is correct.",
      });
    } else {
      checks.push({
        id: `framework-match:${project.name}`,
        title: `Framework detection (${project.name})`,
        status: "ok",
        detail: `Configured framework "${project.framework}" agrees with detection (confidence: ${detectedFramework.confidence}).`,
      });
    }

    if (project.platform === "web" && project.devServer?.command) {
      const scriptName = extractScriptName(project.devServer.command);
      const manifest = readPackageJson(rootAbs);
      const scripts = manifest?.scripts ?? {};
      const hasScript = scriptName !== undefined && Object.hasOwn(scripts, scriptName);
      checks.push({
        id: `dev-server-script:${project.name}`,
        title: `Dev server script (${project.name})`,
        status: hasScript ? "ok" : "warn",
        detail: hasScript
          ? `Script "${scriptName}" referenced by devServer.command exists in package.json.`
          : `Could not find a package.json script matching devServer.command "${project.devServer.command}" at ${rootAbs}.`,
        hint: hasScript ? undefined : "Verify devServer.command matches an existing package.json script.",
      });
    }
  }

  return checks;
}

const META_FRAMEWORK_PAIRS: ReadonlyArray<{
  detected: WebFramework;
  misconfigured: WebFramework;
  label: string;
}> = [
  { detected: "next", misconfigured: "react", label: "Next.js detected but configured as React" },
  { detected: "nuxt", misconfigured: "vue", label: "Nuxt detected but configured as Vue" },
];

const FIRST_CLASS_FRAMEWORKS = new Set<WebFramework>(
  FIRST_CLASS_ADAPTERS.map((adapter) => adapter.framework),
);

async function checkAdapterIntegration(
  config: ResolvedConfig,
  project: ResolvedWebProject,
): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const rootAbs = resolveProjectPath(config.configDir, project.rootDir);
  const detection = await detectProject({ cwd: rootAbs });
  const detectedFramework = detection.project.framework.framework;

  for (const pair of META_FRAMEWORK_PAIRS) {
    if (
      detectedFramework === pair.detected &&
      project.framework === pair.misconfigured
    ) {
      checks.push({
        id: `adapter-meta-framework:${project.name}`,
        title: `Adapter mismatch (${project.name})`,
        status: "warn",
        detail: `${pair.label}. Use framework "${pair.detected}" for dedicated route discovery and readiness.`,
        hint: `Update framework to "${pair.detected}" in the configuration.`,
      });
    }
  }

  if (
    project.adapterId === "generic-web" &&
    detectedFramework !== "unknown" &&
    FIRST_CLASS_FRAMEWORKS.has(detectedFramework)
  ) {
    checks.push({
      id: `adapter-generic-web:${project.name}`,
      title: `Adapter selection (${project.name})`,
      status: "warn",
      detail: `Project "${project.name}" resolves to the generic-web adapter but detection found first-class framework "${detectedFramework}".`,
      hint: `Set framework to "${detectedFramework}" for adapter-specific route discovery and readiness.`,
    });
  } else if (
    project.adapterId === "generic-web" &&
    !FIRST_CLASS_FRAMEWORKS.has(project.framework)
  ) {
    checks.push({
      id: `adapter-generic-web:${project.name}`,
      title: `Adapter selection (${project.name})`,
      status: "ok",
      detail: `Framework "${project.framework}" uses the generic-web adapter (support varies by framework).`,
    });
  }

  const adapter =
    resolveAdapter({ framework: project.framework, platform: project.platform }) ??
    resolveAdapter({ framework: "unknown", platform: "web" });
  if (adapter) {
    const context = createAdapterContext(rootAbs, config.configDir, project);
    const discovery = await adapter.discoverRoutes(context);
    const adapterDiagnostics = await adapter.getDiagnostics(context);

    for (const diagnostic of [...discovery.diagnostics, ...adapterDiagnostics]) {
      checks.push({
        id: `adapter-diagnostic:${project.name}:${diagnostic.code}`,
        title: `Adapter diagnostic (${project.name})`,
        status:
          diagnostic.severity === "error"
            ? "fail"
            : diagnostic.severity === "warning"
              ? "warn"
              : "ok",
        detail: diagnostic.message,
        hint: diagnostic.hint,
      });
    }

    const samples = project.routeDiscovery.samples;
    for (const skipped of discovery.skippedPatterns) {
      const samplePaths = samples[skipped.pattern];
      if (!samplePaths || samplePaths.length === 0) {
        checks.push({
          id: `adapter-dynamic-samples:${project.name}:${skipped.pattern}`,
          title: `Dynamic route samples (${project.name})`,
          status: "warn",
          detail: `Dynamic pattern "${skipped.pattern}" has no samples configured.`,
          hint: 'Add sample paths under routeDiscovery.samples or list explicit routes.',
        });
      }
    }
  }

  if (project.framework === "angular" || detectedFramework === "angular") {
    const angularJson = readAngularJson(rootAbs);
    const projectNames = angularJson?.projects
      ? Object.keys(angularJson.projects)
      : [];
    if (projectNames.length > 1 && !angularJson?.defaultProject) {
      checks.push({
        id: `adapter-angular-workspace:${project.name}`,
        title: `Angular workspace (${project.name})`,
        status: "warn",
        detail: `angular.json defines ${projectNames.length} projects without defaultProject.`,
        hint: "Set defaultProject in angular.json or list routes explicitly in a11yst.config.ts.",
      });
    }
  }

  return checks;
}

async function checkWorkspaceCoverage(cwd: string, config: ResolvedConfig): Promise<DoctorCheck | undefined> {
  const workspace = await detectWorkspace({ cwd });
  const isRealWorkspace = !workspace.diagnostics.some(
    (d) => d.code === "WORKSPACE_CONFIG_NOT_FOUND",
  );
  if (!isRealWorkspace || workspace.projects.length <= config.projects.length) {
    return undefined;
  }

  const configuredRoots = new Set(
    config.projects.map((project) => resolve(resolveProjectPath(config.configDir, project.rootDir))),
  );
  const unconfigured = workspace.projects.filter(
    (project) => !configuredRoots.has(resolve(project.rootDir)),
  );

  if (unconfigured.length === 0) {
    return undefined;
  }

  return {
    id: "workspace-coverage",
    title: "Workspace coverage",
    status: "warn",
    detail: `Workspace has ${workspace.projects.length} detected app(s) but only ${config.projects.length} configured. Unconfigured: ${unconfigured
      .map((project) => project.relativeRoot)
      .join(", ")}.`,
    hint: "Add these projects to the configuration if they should be audited, or ignore this if intentional.",
  };
}

export async function runDoctor(cwd: string): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];

  const nodeOk = isNodeCompatible(
    process.versions.node,
    productMetadata.minNodeVersion,
  );
  checks.push({
    id: "node-version",
    title: "Node.js version",
    status: nodeOk ? "ok" : "fail",
    detail: nodeOk
      ? `Node.js ${process.versions.node} satisfies minimum ${productMetadata.minNodeVersion}.`
      : `Node.js ${process.versions.node} is below minimum ${productMetadata.minNodeVersion}.`,
    hint: nodeOk
      ? undefined
      : `Upgrade Node.js to ${productMetadata.minNodeVersion} or newer.`,
  });

  const configPath = findConfigPath(cwd);
  let config: ResolvedConfig | undefined;

  if (!configPath) {
    checks.push({
      id: "config-exists",
      title: "Configuration file",
      status: "fail",
      detail: `No ${productMetadata.command}.config.* found from ${cwd}.`,
      hint: `Run \`${productMetadata.command} init\` to create a starter configuration.`,
    });
  } else {
    checks.push({
      id: "config-exists",
      title: "Configuration file",
      status: "ok",
      detail: `Found ${configPath}.`,
    });

    try {
      config = await loadConfig({ cwd, configPath });
      checks.push({
        id: "config-valid",
        title: "Configuration validity",
        status: "ok",
        detail: `Configuration is valid (${config.projects.length} project(s)).`,
      });
    } catch (error) {
      const detail =
        error instanceof ConfigError
          ? error.format()
          : error instanceof Error
            ? error.message
            : String(error);
      checks.push({
        id: "config-valid",
        title: "Configuration validity",
        status: "fail",
        detail,
        hint:
          error instanceof ConfigError
            ? error.hint
            : "Fix validation errors in the configuration file.",
      });
    }
  }

  checks.push(checkArtifactsWritable(cwd));
  checks.push(checkPackageManager(cwd));
  checks.push(await checkPlaywrightChromium());

  if (config) {
    checks.push(...(await checkProjectsAgainstDetection(config)));

    for (const project of config.projects) {
      if (project.platform === "web") {
        checks.push(...(await checkAdapterIntegration(config, project)));
      }
    }

    for (const [index, diagnostic] of config.diagnostics.entries()) {
      checks.push({
        id: `config-diagnostic:${diagnostic.code}:${index}`,
        title: `Configuration diagnostic (${diagnostic.code})`,
        status:
          diagnostic.severity === "error" ? "fail" : diagnostic.severity === "warning" ? "warn" : "ok",
        detail: diagnostic.message,
        hint: diagnostic.hint,
      });
    }

    const workspaceCheck = await checkWorkspaceCoverage(cwd, config);
    if (workspaceCheck) {
      checks.push(workspaceCheck);
    }
  }

  return {
    status: worstStatus(checks.map((check) => check.status)),
    checks,
  };
}

export function formatDoctorHuman(report: DoctorReport): string {
  const lines = [
    "Environment check",
    "",
    `Overall status: ${report.status.toUpperCase()}`,
    "",
  ];

  for (const check of report.checks) {
    lines.push(`[${check.status.toUpperCase()}] ${check.title}`);
    lines.push(`  ${check.detail}`);
    if (check.hint) {
      lines.push(`  Hint: ${check.hint}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function formatDoctorJson(report: DoctorReport): unknown {
  return {
    status: report.status,
    product: productMetadata.name,
    checks: report.checks,
  };
}
