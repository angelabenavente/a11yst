import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const flowExampleDir = resolve(repoRoot, "examples/flows/html-dialog");

const DOCUMENTED_FLOW_ACTIONS = [
  "goto",
  "click",
  "fill",
  "press",
  "check",
  "uncheck",
  "select",
  "wait-for",
  "wait-for-url",
  "expect-visible",
  "expect-hidden",
  "expect-text",
  "expect-url",
  "checkpoint",
] as const;

describe("documented flow example", () => {
  it("loads html-dialog flows with real step types and checkpoints", async () => {
    const config = await loadConfig({ cwd: flowExampleDir });
    const project = config.projects[0];
    if (!project || project.platform !== "web") {
      throw new Error("expected web project");
    }

    expect(project.flows?.length).toBeGreaterThan(0);

    const dialogFlow = project.flows?.find((flow) => flow.id === "dialog-accessible");
    expect(dialogFlow).toBeDefined();
    expect(dialogFlow?.start).toBe("/accessible");

    const actions = new Set(dialogFlow?.steps.map((step) => step.action));
    for (const action of actions) {
      expect(DOCUMENTED_FLOW_ACTIONS).toContain(action);
    }

    const checkpoints = dialogFlow?.steps.filter((step) => step.action === "checkpoint") ?? [];
    expect(checkpoints.length).toBe(2);
    expect(
      checkpoints.map((step) => (step.action === "checkpoint" ? step.id : undefined)),
    ).toEqual(["dialog-open", "dialog-closed"]);
  });
});
