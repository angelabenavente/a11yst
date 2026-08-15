import { loadConfig } from "@a11yst/config";
import { serializeLocatorDescription } from "@a11yst/flows";
import type { FlowStepConfig, NormalizedFlow, ResolvedWebProject } from "@a11yst/types";
import { formatLabelValue } from "../output.js";

export interface FlowsFlowEntry {
  id: string;
  name: string;
  start: string;
  profiles: string[];
  viewports: string[];
  requiredEnvVars: string[];
  steps: Array<{
    index: number;
    action: string;
    description: string;
  }>;
}

export interface FlowsProjectResult {
  name: string;
  flows: FlowsFlowEntry[];
}

export interface FlowsResult {
  projects: FlowsProjectResult[];
}

export interface RunFlowsOptions {
  cwd: string;
  projectName?: string[];
  configPath?: string;
  json?: boolean;
}

function describeStep(step: FlowStepConfig): { action: string; description: string } {
  switch (step.action) {
    case "checkpoint":
      return { action: "checkpoint", description: step.id };
    case "goto":
      return { action: "goto", description: step.path };
    case "press":
      return { action: "press", description: step.key };
    case "wait-for-url":
      return { action: "wait-for-url", description: step.path ?? step.url ?? "(url)" };
    case "expect-url":
      return { action: "expect-url", description: step.path ?? step.url ?? "(url)" };
    case "expect-text":
      return { action: "expect-text", description: `"${step.text}"` };
    default: {
      const locatorStep = step as Extract<FlowStepConfig, { locator: unknown }>;
      if ("locator" in locatorStep && locatorStep.locator) {
        return {
          action: step.action,
          description: serializeLocatorDescription(locatorStep.locator),
        };
      }
      return { action: step.action, description: "" };
    }
  }
}

function mapFlow(flow: NormalizedFlow): FlowsFlowEntry {
  return {
    id: flow.id,
    name: flow.name,
    start: flow.start,
    profiles: flow.profiles,
    viewports: flow.viewportNames,
    requiredEnvVars: flow.requiredEnvVars,
    steps: flow.steps.map((step, index) => ({
      index: index + 1,
      ...describeStep(step),
    })),
  };
}

export async function runFlows(options: RunFlowsOptions): Promise<FlowsResult> {
  const config = await loadConfig({
    cwd: options.cwd,
    configPath: options.configPath,
  });

  const filter = options.projectName?.length ? new Set(options.projectName) : undefined;
  const projects: FlowsProjectResult[] = [];

  for (const project of config.projects) {
    if (project.platform !== "web") continue;
    if (filter && !filter.has(project.name)) continue;
    const webProject = project as ResolvedWebProject;
    projects.push({
      name: webProject.name,
      flows: webProject.flows.map(mapFlow),
    });
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

export function formatFlowsHuman(result: FlowsResult): string {
  const blocks: string[] = [];

  for (const project of result.projects) {
    for (const flow of project.flows) {
      blocks.push(formatLabelValue("Project", project.name));
      blocks.push(formatLabelValue("Flow", flow.id));
      if (flow.name !== flow.id) {
        blocks.push(formatLabelValue("Name", flow.name));
      }
      blocks.push(formatLabelValue("Start", flow.start));
      blocks.push(formatLabelValue("Profiles", flow.profiles.join(", ")));
      blocks.push(formatLabelValue("Viewports", flow.viewports.join(", ")));
      blocks.push("");
      blocks.push("Steps");
      for (const step of flow.steps) {
        blocks.push(`${step.index}. ${step.action.padEnd(12)} ${step.description}`);
      }
      if (flow.requiredEnvVars.length > 0) {
        blocks.push("");
        blocks.push("Required environment variables");
        for (const envVar of flow.requiredEnvVars) {
          blocks.push(`- ${envVar}`);
        }
      }
      blocks.push("");
    }
  }

  if (blocks.length === 0) {
    blocks.push("No configured flows found.");
  }

  return blocks.join("\n").trimEnd();
}

export function formatFlowsJson(result: FlowsResult): unknown {
  return result;
}
