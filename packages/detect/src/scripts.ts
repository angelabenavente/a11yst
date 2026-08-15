import { join } from "node:path";
import type {
  DetectionConfidence,
  DetectionEvidence,
  DevServerCandidate,
  Diagnostic,
  PackageManagerName,
  WebFramework,
} from "@a11yst/types";
import { hasDependency, listScripts, type PackageManifest } from "./manifests.js";
import { sortEvidence } from "./evidence.js";
import { detectStaticViteConfigPort } from "./vite-config-port.js";

/**
 * Script names checked for a runnable dev server, in preference order.
 * The resulting `devServers` array preserves this order, so index 0 is
 * always the best guess.
 */
export const DEV_SCRIPT_NAMES: readonly string[] = ["dev", "start", "serve", "develop"];

const PORT_PATTERNS: readonly RegExp[] = [
  /--port[=\s]+(\d{2,5})\b/i,
  /(?:^|\s)-p\s+(\d{2,5})\b/i,
  /\bPORT=(\d{2,5})\b/,
  /localhost:(\d{2,5})\b/i,
];

function parsePortFromScript(scriptValue: string): number | undefined {
  for (const pattern of PORT_PATTERNS) {
    const match = pattern.exec(scriptValue);
    if (match?.[1]) {
      const port = Number(match[1]);
      if (Number.isInteger(port) && port > 0 && port < 65536) {
        return port;
      }
    }
  }
  return undefined;
}

/**
 * Build the shell command a user would run to start `scriptName`, using
 * the project's detected package manager. This command is only ever
 * returned as data — a11yst detection never executes it.
 */
export function buildDevCommand(
  packageManager: PackageManagerName,
  scriptName: string,
): string {
  switch (packageManager) {
    case "pnpm":
      return `pnpm ${scriptName}`;
    case "yarn":
      return `yarn ${scriptName}`;
    case "bun":
      return `bun run ${scriptName}`;
    case "npm":
    case "unknown":
    default:
      return `npm run ${scriptName}`;
  }
}

/** Well-known default dev-server ports, used only when no explicit port is found. */
function inferDefaultPort(
  framework: WebFramework,
  manifest: PackageManifest | undefined,
): number | undefined {
  switch (framework) {
    case "next":
    case "nuxt":
      return 3000;
    case "angular":
      return 4200;
    case "astro":
      return 4321;
    case "svelte":
    case "sveltekit":
      return 5173;
    case "react":
      if (hasDependency(manifest, "react-scripts")) {
        return 3000;
      }
      if (hasDependency(manifest, "vite")) {
        return 5173;
      }
      return undefined;
    default:
      return hasDependency(manifest, "vite") ? 5173 : undefined;
  }
}

/**
 * Discover candidate dev-server commands from `package.json` scripts.
 *
 * Never executes anything: commands are built from static templates and
 * ports are parsed with regexes or filled in from well-known framework
 * defaults, clearly marked as low-confidence guesses.
 */
export function detectDevServers(
  rootDir: string,
  manifest: PackageManifest | undefined,
  packageManagerName: PackageManagerName,
  framework: WebFramework,
): { devServers: DevServerCandidate[]; diagnostics: Diagnostic[] } {
  const scripts = listScripts(manifest);
  const diagnostics: Diagnostic[] = [];
  const devServers: DevServerCandidate[] = [];

  for (const scriptName of DEV_SCRIPT_NAMES) {
    const scriptValue = scripts[scriptName];
    if (typeof scriptValue !== "string" || scriptValue.trim().length === 0) {
      continue;
    }

    const command = buildDevCommand(packageManagerName, scriptName);
    const evidence: DetectionEvidence[] = [
      {
        type: "package-script",
        value: `${scriptName}: ${scriptValue}`,
        description: `package.json script "${scriptName}" can start a development server.`,
        weight: 1,
      },
    ];

    const explicitPort = parsePortFromScript(scriptValue);
    const viteConfigPort = explicitPort === undefined ? detectStaticViteConfigPort(rootDir) : undefined;
    let inferredPort: number | undefined = explicitPort ?? viteConfigPort?.port;
    let inferredUrlSource: string | undefined;
    let confidence: DetectionConfidence;

    if (explicitPort !== undefined) {
      confidence = "high";
      inferredUrlSource = `package.json · "${scriptName}" script port`;
      evidence.push({
        type: "configuration",
        value: String(explicitPort),
        description: `Script explicitly configures port ${explicitPort}.`,
        weight: 2,
      });
    } else if (viteConfigPort !== undefined) {
      confidence = "high";
      inferredUrlSource = viteConfigPort.sourceLabel;
      evidence.push({
        type: "configuration",
        value: String(viteConfigPort.port),
        description: `Static Vite config declares server.port ${viteConfigPort.port}.`,
        weight: 2,
      });
      evidence.push({
        type: "file",
        value: viteConfigPort.sourceFile,
        description: `Found ${viteConfigPort.sourceFile} with a statically parseable server.port.`,
        weight: 2,
      });
    } else {
      const fallbackPort = inferDefaultPort(framework, manifest);
      if (fallbackPort !== undefined) {
        inferredPort = fallbackPort;
        confidence = "medium";
        inferredUrlSource =
          framework === "react" || framework === "vue" || hasDependency(manifest, "vite")
            ? "Vite default"
            : `${framework} default`;
        evidence.push({
          type: "fallback",
          value: String(fallbackPort),
          description: `Assumed the conventional default port ${fallbackPort} for framework "${framework}" (no explicit port found in the script).`,
          weight: 1,
        });
      } else {
        confidence = "low";
      }
    }

    const inferredUrl = inferredPort !== undefined ? `http://localhost:${inferredPort}` : undefined;

    if (inferredPort === undefined) {
      diagnostics.push({
        code: "DEV_SERVER_PORT_UNKNOWN",
        severity: "info",
        message: `Could not infer a port for script "${scriptName}" ("${scriptValue}").`,
        hint: "Set devServer.url explicitly in your a11yst config.",
        path: join(rootDir, "package.json"),
      });
    }

    devServers.push({
      command,
      sourceScript: scriptName,
      confidence,
      inferredPort,
      inferredUrl,
      inferredUrlSource,
      evidence: sortEvidence(evidence),
    });
  }

  if (devServers.length === 0) {
    diagnostics.push({
      code: "DEV_SERVER_NOT_FOUND",
      severity: "info",
      message: `No ${DEV_SCRIPT_NAMES.map((n) => `"${n}"`).join("/")} script found in package.json.`,
      path: join(rootDir, "package.json"),
    });
  }

  return { devServers, diagnostics };
}
