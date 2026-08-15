import { resolve } from "node:path";
import { Command } from "commander";
import { ConfigError } from "@a11yst/config";
import { productMetadata } from "@a11yst/types";
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
  formatRoutesHuman,
  formatRoutesJson,
  runRoutes,
} from "./commands/routes.js";
import { writeJson, writeStderr, writeStdout } from "./output.js";
import { createBrandHeader } from "./presentation/index.js";

export interface RunCliOptions {
  argv?: string[];
  cwd?: string;
}

/** Commander "collect" helper for repeatable `--project <name>` flags. */
function collectProjectNames(value: string, previous: string[]): string[] {
  return [...previous, value];
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
