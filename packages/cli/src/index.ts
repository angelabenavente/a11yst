import { resolve } from "node:path";
import { Command } from "commander";
import { ConfigError, loadConfig } from "@a11yst/config";
import { getAuditExitCode, resolveCiPolicyConfig } from "@a11yst/policy";
import type { AccessibilityProfile } from "@a11yst/types";
import { productMetadata } from "@a11yst/types";
import { parseCiPolicyCliOptions } from "./ci-policy-options.js";
import { formatAuditHuman, formatAuditJson } from "./commands/audit.js";
import {
  formatReportHuman,
  formatReportJson,
  runReport,
} from "./commands/report.js";
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
    .option("--output <path>", "Directory for audit results and reports")
    .option("--no-html", "Do not generate an HTML report")
    .option("--sarif", "Generate a SARIF 2.1.0 report in the audit bundle", false)
    .option("--no-sarif", "Do not generate a SARIF report even when enabled in config")
    .option("--sarif-output <path>", "Also write the SARIF report to this path")
    .option("--junit", "Generate a JUnit XML report in the audit bundle", false)
    .option("--no-junit", "Do not generate a JUnit report even when enabled in config")
    .option("--junit-output <path>", "Also write the JUnit report to this path")
    .option("--no-markdown", "Do not generate a Markdown report")
    .option("--markdown-output <path>", "Also write the Markdown report to this path")
    .option("--no-screenshots", "Do not capture screenshot evidence")
    .option("--full-page-screenshots", "Capture full-page screenshots", false)
    .option("--no-baseline", "Do not compare against a baseline file")
    .option("--baseline <path>", "Compare against this baseline file")
    .option("--fail-on-new", "Fail CI policy when new findings meet the severity threshold", false)
    .option("--no-fail-on-new", "Do not fail CI policy on new findings")
    .option(
      "--fail-on-regression",
      "Fail CI policy when regressed findings meet the severity threshold",
      false,
    )
    .option("--no-fail-on-regression", "Do not fail CI policy on regressions")
    .option(
      "--fail-on-expired-classification",
      "Fail CI policy when an accepted classification has expired",
      false,
    )
    .option(
      "--no-fail-on-expired-classification",
      "Do not fail CI policy on expired classifications",
    )
    .option(
      "--minimum-severity <severity>",
      "Minimum severity for CI policy breaches (minor, medium, high, critical)",
    )
    .option(
      "--color <mode>",
      "Color output for human presentation (auto, always, never)",
      "auto",
    )
    .option("--verbose", "Include technical finding details in human output", false)
    .addHelpText(
      "after",
      `
CI policy flags override the ci section in your a11yst config. CLI values take
precedence over configuration. Setting --minimum-severity alone does not enable
the policy; at least one fail-on flag must be enabled.

Enabled CI policy requires baseline comparison. Use a baseline file or remove
--no-baseline.

Exit codes:
  0  Audit completed; CI policy disabled or passed
  1  Operational/config error, or CI policy could not be evaluated
  2  Audit completed but CI policy failed

false-positive and not-applicable classifications are excluded from policy
breaches. accepted-risk, third-party, and manual-review may still block when
new or regressed. A baseline records known debt; it does not make findings pass.

SARIF reports are disabled by default. Use --sarif to generate
reports/a11yst.sarif inside the audit bundle. Use --sarif-output to
also write an identical copy to a custom path.

JUnit reports are disabled by default. Use --junit to generate
reports/a11yst.junit.xml inside the audit bundle. Use --junit-output to
also write an identical copy to a custom path.

Markdown reports are generated by default in the audit bundle at
reports/a11yst.md. Use --no-markdown to skip generation. Use --markdown-output for an
external copy.

${AUDIT_HELP_DISCLAIMER}
`,
    )
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
        html?: boolean;
        sarif?: boolean;
        noSarif?: boolean;
        sarifOutput?: string;
        junit?: boolean;
        noJunit?: boolean;
        junitOutput?: string;
        markdown?: boolean;
        noMarkdown?: boolean;
        markdownOutput?: string;
        screenshots?: boolean;
        fullPageScreenshots?: boolean;
        baseline?: string | boolean;
        failOnNew?: boolean;
        noFailOnNew?: boolean;
        failOnRegression?: boolean;
        noFailOnRegression?: boolean;
        failOnExpiredClassification?: boolean;
        noFailOnExpiredClassification?: boolean;
        minimumSeverity?: string;
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
          const { overrides: ciOverrides, explicitFlagsUsed } = parseCiPolicyCliOptions(
            {
              failOnNew: opts.failOnNew,
              noFailOnNew: opts.noFailOnNew,
              failOnRegression: opts.failOnRegression,
              noFailOnRegression: opts.noFailOnRegression,
              failOnExpiredClassification: opts.failOnExpiredClassification,
              noFailOnExpiredClassification: opts.noFailOnExpiredClassification,
              minimumSeverity: opts.minimumSeverity,
            },
            argv,
          );
          const resolvedCiPolicy = resolveCiPolicyConfig({
            configPolicy: config.ci,
            cliOverrides: ciOverrides,
          });
          const baselineOverride =
            typeof opts.baseline === "string" ? opts.baseline : undefined;
          const noBaseline = opts.baseline === false;
          const {
            executeAudit,
            resolveSarifReportOptions,
            resolveJunitReportOptions,
            resolveMarkdownReportOptions,
          } = await import("@a11yst/core");
          const sarifOptions = resolveSarifReportOptions({
            config: config.reports,
            cli: {
              sarif: opts.sarif || undefined,
              noSarif: opts.noSarif || undefined,
              sarifOutput: opts.sarifOutput,
            },
          });
          const sarifExternalOutputPath = opts.sarifOutput
            ? resolve(resolveCwd(opts.cwd), opts.sarifOutput)
            : undefined;
          const junitOptions = resolveJunitReportOptions({
            config: config.reports,
            cli: {
              junit: opts.junit || undefined,
              noJunit: opts.noJunit || undefined,
              junitOutput: opts.junitOutput,
            },
          });
          const junitExternalOutputPath = opts.junitOutput
            ? resolve(resolveCwd(opts.cwd), opts.junitOutput)
            : undefined;
          const markdownOptions = resolveMarkdownReportOptions({
            config: config.reports,
            cli: {
              markdown: opts.markdown === false ? false : undefined,
              noMarkdown: opts.noMarkdown || undefined,
              markdownOutput: opts.markdownOutput,
            },
          });
          const markdownExternalOutputPath = opts.markdownOutput
            ? resolve(resolveCwd(opts.cwd), opts.markdownOutput)
            : undefined;
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
            html: opts.html === false ? false : undefined,
            screenshots: opts.screenshots === false ? false : undefined,
            fullPageScreenshots: opts.fullPageScreenshots || undefined,
            signal: controller.signal,
            noBaseline: noBaseline || undefined,
            baselinePath: baselineOverride,
            explicitBaselineRequired: Boolean(baselineOverride),
            ciPolicy: resolvedCiPolicy,
            sarif: sarifOptions,
            sarifExternalOutputPath,
            junit: junitOptions,
            junitExternalOutputPath,
            markdown: markdownOptions,
            markdownExternalOutputPath,
            progress,
          });

          if (opts.json) {
            writeJson(formatAuditJson(result));
          } else {
            const capabilities = resolveTerminalCapabilities();
            const body = formatAuditHuman(result, {
              explicitCiFlagsUsed: explicitFlagsUsed,
              minimumSeverity: resolvedCiPolicy.minimumSeverity,
              sarifExternalPath: sarifExternalOutputPath,
              junitExternalPath: junitExternalOutputPath,
              markdownExternalPath: markdownExternalOutputPath,
              colorMode: parseColorMode(
                typeof opts.color === "string" ? opts.color : undefined,
              ),
              capabilities,
              presentationMode: resolveTerminalPresentationMode(capabilities),
              verbose: opts.verbose || undefined,
            });
            writeStdout(prependHumanBrandHeader(body, capabilities));
          }
          process.exitCode = getAuditExitCode({
            auditIncomplete: result.status !== "completed",
            policyEvaluation: result.policyEvaluation,
          });
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
    .command("report [resultsPath]")
    .description("Generate HTML, SARIF, JUnit, or Markdown reports from persisted audit results")
    .option("--from <path>", "Path to a results.json file (alias for positional argument)")
    .option("--format <format>", "Report format: html, sarif, junit, or markdown", "html")
    .option("--output <path>", "Output directory for HTML or output file path for machine formats")
    .option("--json", "Emit machine-readable JSON on stdout", false)
    .option("--cwd <path>", "Directory used to resolve paths and configuration")
    .addHelpText(
      "after",
      `
When --format sarif is used, a11yst reads an existing results.json file,
generates SARIF 2.1.0 offline, and writes a11yst.sarif by default.

When --format junit is used, a11yst reads an existing results.json file,
generates JUnit XML offline, and writes a11yst.junit.xml by default.

When --format markdown is used, a11yst generates reports/a11yst.md offline.

No browser, server, baseline comparison, or policy re-evaluation runs.`,
    )
    .action(
      async (resultsPath: string | undefined, opts: {
        from?: string;
        format?: string;
        output?: string;
        json?: boolean;
        cwd?: string;
      }) => {
        const progress = createCliProgressReporter({
          json: opts.json,
          colorMode: parseColorMode(undefined),
        });
        try {
          progress.start("Regenerating report…");
          const format =
            opts.format === "sarif"
              ? "sarif"
              : opts.format === "junit"
                ? "junit"
                : opts.format === "markdown"
                  ? "markdown"
                  : "html";
          const result = await runReport({
            cwd: resolveCwd(opts.cwd),
            resultsPath: opts.from ?? resultsPath,
            output: opts.output,
            format,
          });
          progress.succeed("Report ready");
          if (opts.json) {
            writeJson(formatReportJson(result));
          } else {
            writeStdout(formatReportHuman(result));
          }
          process.exitCode = 0;
        } catch (error) {
          progress.fail("Report generation failed");
          const message = error instanceof Error ? error.message : String(error);
          if (opts.json) {
            writeJson({ status: "error", message }, process.stdout);
          }
          writeStderr(message);
          process.exitCode = 1;
        } finally {
          progress.stop();
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
  formatReportHuman,
  formatReportJson,
  runReport,
} from "./commands/report.js";
export {
  formatProfilesHuman,
  formatProfilesJson,
  runProfiles,
} from "./commands/profiles.js";
