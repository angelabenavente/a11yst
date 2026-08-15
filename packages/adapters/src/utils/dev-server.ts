import type { DevServerRecommendation, AdapterContext } from "../types.js";

const DEV_SCRIPT_NAMES = ["dev", "start", "serve", "develop"] as const;

const PORT_PATTERNS: readonly RegExp[] = [
  /--port[=\s]+(\d{2,5})\b/i,
  /(?:^|\s)-p\s+(\d{2,5})\b/i,
  /\bPORT=(\d{2,5})\b/,
  /localhost:(\d{2,5})\b/i,
];

const DEFAULT_PORTS: Partial<Record<string, number>> = {
  next: 3000,
  nuxt: 3000,
  angular: 4200,
  react: 5173,
  vue: 5173,
};

function readScripts(packageJson: object | undefined): Record<string, string> {
  if (!packageJson || typeof packageJson !== "object") {
    return {};
  }
  const scripts = (packageJson as { scripts?: unknown }).scripts;
  if (!scripts || typeof scripts !== "object") {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(scripts)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

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
 * Recommend a dev-server command and URL from package.json scripts.
 * Commands are never executed — this is planning metadata only.
 */
export function recommendDevServerFromScripts(
  context: AdapterContext,
  frameworkHint?: string,
): DevServerRecommendation {
  const scripts = readScripts(context.packageJson);
  for (const scriptName of DEV_SCRIPT_NAMES) {
    const scriptValue = scripts[scriptName];
    if (typeof scriptValue !== "string" || scriptValue.trim().length === 0) {
      continue;
    }

    const command = `npm run ${scriptName}`;
    const explicitPort = parsePortFromScript(scriptValue);
    const fallbackPort =
      explicitPort ?? (frameworkHint ? DEFAULT_PORTS[frameworkHint] : undefined);
    const url =
      fallbackPort !== undefined ? `http://localhost:${fallbackPort}` : undefined;

    return {
      command,
      url,
      hint: explicitPort
        ? `Inferred port ${explicitPort} from the "${scriptName}" script.`
        : fallbackPort
          ? `Assumed conventional port ${fallbackPort} for ${frameworkHint ?? "this framework"}.`
          : `Found "${scriptName}" script; set devServer.url if the port differs.`,
    };
  }

  return {
    hint: "No dev/start/serve/develop script found in package.json.",
  };
}
