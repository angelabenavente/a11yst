import { resolve } from "node:path";
import { Command } from "commander";
import { ConfigError, loadConfig } from "@a11yst/config";
import type { AccessibilityProfile } from "@a11yst/types";
import { productMetadata } from "@a11yst/types";
import { formatAuditHuman, formatAuditJson } from "./commands/audit.js";
import {
  formatDetectHuman,
  formatDetectJson,
  runDetect,
} from "./commands/detect.js";
import {
  formatFlowsHuman,
  formatFlowsJson,
  runFlows,
} from "./commands/flows.js";
import {
  formatProfilesHuman,
  runProfiles,
} from "./commands/profiles.js";
import {
  formatRoutesHuman,
  formatRoutesJson,
  runRoutes,
} from "./commands/routes.js";
import { createCliProgressReporter } from "./cli-progress.js";
import { writeJson, writeStderr, writeStdout } from "./output.js";
import {
  AUDIT_HELP_DISCLAIMER,
  createBrandHeader,
  parseColorMode,
  prependHumanBrandHeader,
  resolveTerminalCapabilities,
  resolveTerminalPresentationMode,
} from "./presentation/index.js";

export interface RunCliOptions {
  argv?: string[];
  cwd?: string;
}

/** Commander "collect" helper for repeatable `--project <name>` flags. */
function collectProjectNames(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function collectProfileNames(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function collectFlowNames(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parsePositiveInteger(value: string, optionName: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${optionName} must be a positive integer; received "${value}".`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer; received "${value}".`);
  }
  return parsed;
}

function getAuditExitCode(status: string): number {
  return status === "completed" ? 0 : 1;
}

export async function runCli(options: RunCliOptions = {}): Promise<number> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const argv = options.argv ?? process.argv;

  function resolveCwd(cwdFlag?: string): string {
    return cwdFlag ? resolve(cwd, cwdFlag) : cwd;
  }

  const program = new Command();
  program
    .name(productMetadata.command)
    .description(
      `${productMetadata.name} — ${productMetadata.tagline}`,
    )
    .version(productMetadata.version, "-V, --version", "Print the version number")
    .helpOption("-h, --help", "Display help information")
    .showHelpAfterError()
    .configureOutput({
      writeOut: (str) => process.stdout.write(str),
      writeErr: (str) => process.stderr.write(str),
    });

  program.addHelpText("before", () => `${createBrandHeader({ tagline: true })}\n\n`);

  program
    .command("detect")
    .description("Detect project platform, framework, and package manager")
    .option("--json", "Emit machine-readable JSON on stdout", false)
    .option("--workspace", "Detect every project across a monorepo workspace", false)
    .option("--cwd <path>", "Directory to run detection in")
    .action(async (opts: { json?: boolean; workspace?: boolean; cwd?: string }) => {
      try {
        const result = await runDetect({
          cwd: resolveCwd(opts.cwd),
          workspace: opts.workspace,
        });
        if (opts.json) {
          writeJson(formatDetectJson(result));
        } else {
          writeStdout(formatDetectHuman(result));
        }
        process.exitCode = 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (opts.json) {
          writeJson({ status: "error", message }, process.stdout);
        }
        writeStderr(message);
        process.exitCode = 1;
      }
    });

  program
    .command("flows")
    .description("List configured user flows, steps, and checkpoints without running a browser")
    .option("--json", "Emit machine-readable JSON on stdout", false)
    .option("--config <path>", "Path to a configuration file")
    .option("--cwd <path>", "Directory to load configuration from")
    .option("--project <name>", "Show flows for this project only (repeatable)", collectProjectNames, [] as string[])
    .action(
      async (opts: {
        json?: boolean;
        config?: string;
        cwd?: string;
        project?: string[];
      }) => {
        try {
          const result = await runFlows({
            cwd: resolveCwd(opts.cwd),
            configPath: opts.config,
            projectName: opts.project,
            json: opts.json,
          });
          if (opts.json) {
            writeJson(formatFlowsJson(result));
          } else {
            writeStdout(formatFlowsHuman(result));
          }
          process.exitCode = 0;
        } catch (error) {
          const message =
            error instanceof ConfigError
              ? error.format()
              : error instanceof Error
                ? error.message
                : String(error);
          if (opts.json) {
            writeJson(
              {
                status: "error",
                message,
                code: error instanceof ConfigError ? error.code : "FLOWS_FAILED",
                issues: error instanceof ConfigError ? error.issues : undefined,
              },
              process.stdout,
            );
          }
          writeStderr(message);
          process.exitCode = 1;
        }
      },
    );

  program
    .command("routes")
    .description("Resolve configured routes via framework adapters")
    .option("--json", "Emit machine-readable JSON on stdout", false)
    .option("--config <path>", "Path to a configuration file")
    .option("--cwd <path>", "Directory to load configuration from")
    .option("--project <name>", "Resolve routes for this project only (repeatable)", collectProjectNames, [] as string[])
    .option("--explain", "Show route discovery provenance and unresolved patterns", false)
    .action(
      async (opts: {
        json?: boolean;
        config?: string;
        cwd?: string;
        project?: string[];
        explain?: boolean;
      }) => {
        try {
          const result = await runRoutes({
            cwd: resolveCwd(opts.cwd),
            configPath: opts.config,
            projectName: opts.project,
            json: opts.json,
            explain: opts.explain,
          });
          if (opts.json) {
            writeJson(formatRoutesJson(result));
          } else {
            writeStdout(formatRoutesHuman(result, { explain: opts.explain }));
          }
          process.exitCode = 0;
        } catch (error) {
          const message =
            error instanceof ConfigError
              ? error.format()
              : error instanceof Error
                ? error.message
                : String(error);
          if (opts.json) {
            writeJson(
              {
                status: "error",
                message,
                code: error instanceof ConfigError ? error.code : "ROUTES_FAILED",
                issues: error instanceof ConfigError ? error.issues : undefined,
              },
              process.stdout,
            );
          }
          writeStderr(message);
          process.exitCode = 1;
        }
      },
    );

  program
    .command("audit")
    .description("Run an accessibility audit against your configured projects")
    .option("--json", "Emit machine-readable JSON on stdout", false)
    .option("--config <path>", "Path to a configuration file")
    .option("--cwd <path>", "Directory to load configuration from")
    .option("--headed", "Run with a visible browser window instead of headless", false)
    .option("--timeout <ms>", "Navigation timeout in milliseconds", "30000")
    .option("--no-start-server", "Never start a dev server; fail fast if nothing is already listening")
    .option("--project <name>", "Audit only this project (repeatable)", collectProjectNames, [] as string[])
    .option(
      "--profile <id>",
      "Audit only this accessibility profile (repeatable)",
      collectProfileNames,
      [] as string[],
    )
    .option("--flow <id>", "Audit only this flow (repeatable)", collectFlowNames, [] as string[])
    .option("--flows-only", "Audit only configured flows, not static routes", false)
    .option("--routes-only", "Audit only static routes, not flows", false)
    .option("--flow-timeout <ms>", "Flow step timeout in milliseconds", "10000")
    .option("--output <path>", "Directory for audit results")
    .option("--no-screenshots", "Do not capture screenshot evidence")
    .option("--full-page-screenshots", "Capture full-page screenshots", false)
    .option("--no-baseline", "Do not compare against a baseline file")
    .option("--baseline <path>", "Compare against this baseline file")
    .option(
      "--color <mode>",
      "Color output for human presentation (auto, always, never)",
      "auto",
    )
    .option("--verbose", "Include technical finding details in human output", false)
    .addHelpText("after", `\n${AUDIT_HELP_DISCLAIMER}\n`)
    .action(
      async (opts: {
        json?: boolean;
        config?: string;
        cwd?: string;
        headed?: boolean;
        timeout?: string;
        startServer?: boolean;
        project?: string[];
        profile?: string[];
        flow?: string[];
        flowsOnly?: boolean;
        routesOnly?: boolean;
        flowTimeout?: string;
        output?: string;
        screenshots?: boolean;
        fullPageScreenshots?: boolean;
        baseline?: string | boolean;
        color?: string;
        verbose?: boolean;
      }) => {
        const progress = createCliProgressReporter({
          json: opts.json,
          colorMode: parseColorMode(typeof opts.color === "string" ? opts.color : undefined),
        });
        const controller = new AbortController();
        const onSignal = () => controller.abort();
        process.once("SIGINT", onSignal);
        process.once("SIGTERM", onSignal);

        try {
          const navigationTimeoutMs = parsePositiveInteger(
            opts.timeout ?? "30000",
            "--timeout",
          );
          const stepTimeoutMs = parsePositiveInteger(
            opts.flowTimeout ?? "10000",
            "--flow-timeout",
          );
          progress.start("Loading configuration…");
          const config = await loadConfig({
            cwd: resolveCwd(opts.cwd),
            configPath: opts.config,
          });
          progress.succeed("Configuration loaded");
          const baselineOverride =
            typeof opts.baseline === "string" ? opts.baseline : undefined;
          const noBaseline = opts.baseline === false;
          const { executeAudit } = await import("@a11yst/core");
          const result = await executeAudit(config, {
            headed: opts.headed,
            navigationTimeoutMs,
            stepTimeoutMs,
            noStartServer: opts.startServer === false,
            projectNames: opts.project,
            profileNames: opts.profile as AccessibilityProfile[] | undefined,
            flowNames: opts.flow,
            flowsOnly: opts.flowsOnly || undefined,
            routesOnly: opts.routesOnly || undefined,
            outputDir: opts.output,
            screenshots: opts.screenshots === false ? false : undefined,
            fullPageScreenshots: opts.fullPageScreenshots || undefined,
            signal: controller.signal,
            noBaseline: noBaseline || undefined,
            baselinePath: baselineOverride,
            explicitBaselineRequired: Boolean(baselineOverride),
            progress,
          });

          if (opts.json) {
            writeJson(formatAuditJson(result));
          } else {
            const capabilities = resolveTerminalCapabilities();
            const body = formatAuditHuman(result, {
              colorMode: parseColorMode(
                typeof opts.color === "string" ? opts.color : undefined,
              ),
              capabilities,
              presentationMode: resolveTerminalPresentationMode(capabilities),
              verbose: opts.verbose || undefined,
            });
            writeStdout(prependHumanBrandHeader(body, capabilities));
          }
          process.exitCode = getAuditExitCode(result.status);
        } catch (error) {
          progress.fail("Audit failed");
          if (opts.json) {
            writeJson(
              {
                status: "error",
                message:
                  error instanceof ConfigError
                    ? error.message
                    : error instanceof Error
                      ? error.message
                      : String(error),
                code: error instanceof ConfigError ? error.code : "AUDIT_FAILED",
                issues: error instanceof ConfigError ? error.issues : undefined,
              },
              process.stdout,
            );
          }
          writeStderr(
            error instanceof ConfigError
              ? error.format()
              : error instanceof Error
                ? error.message
                : String(error),
          );
          process.exitCode = 1;
        } finally {
          progress.stop();
          process.removeListener("SIGINT", onSignal);
          process.removeListener("SIGTERM", onSignal);
        }
      },
    );

  program
    .command("profiles")
    .description("List accessibility profiles, capabilities, and limitations")
    .option("--json", "Emit machine-readable JSON on stdout", false)
    .action((opts: { json?: boolean }) => {
      const profiles = runProfiles();
      if (opts.json) {
        writeJson({ profiles });
      } else {
        writeStdout(formatProfilesHuman(profiles));
      }
      process.exitCode = 0;
    });

  try {
    await program.parseAsync(argv);
  } catch (error) {
    writeStderr(error instanceof Error ? error.message : String(error));
    return 1;
  }

  return typeof process.exitCode === "number" ? process.exitCode : 0;
}

export {
  formatDetectHuman,
  formatDetectJson,
  runDetect,
} from "./commands/detect.js";
export {
  formatFlowsHuman,
  formatFlowsJson,
  runFlows,
} from "./commands/flows.js";
export {
  formatRoutesHuman,
  formatRoutesJson,
  runRoutes,
} from "./commands/routes.js";
export { formatAuditHuman, formatAuditJson } from "./commands/audit.js";
export {
  formatProfilesHuman,
  formatProfilesJson,
  runProfiles,
} from "./commands/profiles.js";
