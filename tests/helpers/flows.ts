import { join } from "node:path";
import { loadConfig } from "@a11yst/config";
import { createAuditPlan, executeAudit, type ExecuteAuditOptions } from "@a11yst/core";
import type { AuditExecutionResult, ResolvedConfig } from "@a11yst/types";
import { getFreePort } from "./net.js";
import { repoRoot } from "./cli.js";

export interface FlowExampleAuditOptions extends Omit<ExecuteAuditOptions, "outputDir"> {
  flowsOnly?: boolean;
  routesOnly?: boolean;
  flowNames?: string[];
  profileNames?: ExecuteAuditOptions["profileNames"];
  writeArtifacts?: boolean;
  outputDir?: string;
}

export async function withFlowExamplePort<T>(
  fn: (port: number) => Promise<T>,
): Promise<T> {
  const port = await getFreePort();
  const previousPort = process.env.PORT;
  process.env.PORT = String(port);
  try {
    return await fn(port);
  } finally {
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }
  }
}

export async function loadFlowExampleConfig(exampleDir: string): Promise<ResolvedConfig> {
  return loadConfig({ cwd: exampleDir });
}

export async function runFlowExampleAudit(
  exampleRelativePath: string,
  options: FlowExampleAuditOptions = {},
): Promise<AuditExecutionResult> {
  const exampleDir = join(repoRoot, exampleRelativePath);
  return withFlowExamplePort(async () => {
    const config = await loadFlowExampleConfig(exampleDir);
    return await executeAudit(config, {
      writeArtifacts: options.writeArtifacts ?? false,
      flowsOnly: options.flowsOnly,
      routesOnly: options.routesOnly,
      flowNames: options.flowNames,
      profileNames: options.profileNames,
      outputDir: options.outputDir,
    });
  });
}

export async function planFlowExample(exampleRelativePath: string) {
  const exampleDir = join(repoRoot, exampleRelativePath);
  return withFlowExamplePort(async () => {
    const config = await loadFlowExampleConfig(exampleDir);
    return createAuditPlan(config);
  });
}

export { repoRoot };
