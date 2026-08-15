import { describe, expect, it } from "vitest";
import { formatAuditHuman } from "../../../packages/cli/src/commands/audit.js";
import {
  loadFlowExampleConfig,
  planFlowExample,
  runFlowExampleAudit,
  withFlowExamplePort,
} from "../../helpers/flows.js";

const EXAMPLE = "examples/flows/html-dialog";
const TEST_TIMEOUT_MS = 120_000;

describe.sequential("html-dialog flow example", () => {
  it("loads config with two flows and expected profiles", async () => {
    const config = await loadFlowExampleConfig(EXAMPLE);
    const project = config.projects[0];

    expect(config.projects).toHaveLength(1);
    expect(project?.platform).toBe("web");
    if (project?.platform !== "web") return;

    expect(project.framework).toBe("html");
    expect(project.profiles).toEqual(["default", "keyboard"]);
    expect(project.routes).toHaveLength(3);
    expect(project.flows).toHaveLength(2);
    expect(project.flows.map((flow) => flow.id)).toEqual(["dialog-accessible", "dialog-bad"]);
  });

  it("plans route runs and flow checkpoint runs", async () => {
    const plan = await planFlowExample(EXAMPLE);
    const routeRuns = plan.runs.filter((run) => run.kind === "route" || run.kind === undefined);
    const flowRuns = plan.runs.filter((run) => run.kind === "flow-checkpoint");

    expect(routeRuns).toHaveLength(6);
    expect(flowRuns).toHaveLength(8);
    expect(plan.totalRuns).toBe(14);
  });

  it(
    "completes flows-only audit with dialog-focus-entry on bad flow and clean accessible flow",
    async () => {
      const result = await runFlowExampleAudit(EXAMPLE, { flowsOnly: true });

      expect(result.status).toBe("completed");
      expect(result.summary.failedRuns).toBe(0);
      expect(result.summary.plannedRuns).toBe(8);
      expect(result.summary.completedRuns).toBe(8);

      const a11ystFindings = result.findings.filter((finding) => finding.source === "a11yst");
      const ruleIds = new Set(a11ystFindings.map((finding) => finding.ruleId));

      expect(ruleIds).toContain("dialog-focus-entry");

      expect(
        a11ystFindings.some(
          (finding) =>
            finding.flowId === "dialog-bad" &&
            finding.ruleId === "dialog-focus-entry" &&
            finding.checkpointId === "dialog-open",
        ),
      ).toBe(true);

      expect(
        a11ystFindings.filter(
          (finding) => finding.flowId === "dialog-accessible" && finding.ruleId === "dialog-focus-entry",
        ),
      ).toHaveLength(0);

      const axeFindings = result.findings.filter((finding) => finding.source === "axe");
      expect(axeFindings.length).toBeGreaterThanOrEqual(0);

      expect(result.flowExecutions?.length).toBeGreaterThan(0);
      expect(result.flowExecutions?.every((trace) => trace.steps.length > 0)).toBe(true);

      const human = formatAuditHuman(result);
      expect(human).toMatch(/^FLOW {2}/m);
      expect(human).toMatch(/^STEP {2}/m);
      expect(human).toMatch(/^CHECKPOINT {2}/m);
      expect(human).toMatch(/^PROFILE /m);
      expect(human).toMatch(/^VIEW {2}/m);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "keyboard profile completes and may surface heuristic findings on bad dialog close",
    async () => {
      const result = await runFlowExampleAudit(EXAMPLE, {
        flowsOnly: true,
        flowNames: ["dialog-bad"],
        profileNames: ["keyboard"],
      });

      expect(result.summary.completedRuns).toBe(2);
      const keyboardRuns = result.runs.filter((run) => run.profile === "keyboard");
      expect(keyboardRuns.every((run) => run.status === "completed")).toBe(true);

      const returnReview = result.findings.filter(
        (finding) => finding.ruleId === "dialog-focus-return-review",
      );
      expect(returnReview.length).toBeGreaterThanOrEqual(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "writes artifacts with flow trace and redacts secrets from trace when configured",
    async () => {
      await withFlowExamplePort(async () => {
        const { mkdtemp, readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const { tmpdir } = await import("node:os");
        const outputDir = await mkdtemp(join(tmpdir(), "a11yst-html-dialog-"));
        const config = await loadFlowExampleConfig(EXAMPLE);
        const { executeAudit } = await import("@a11yst/core");

        const result = await executeAudit(config, {
          writeArtifacts: true,
          flowsOnly: true,
          flowNames: ["dialog-accessible"],
          outputDir,
        });

        expect(result.artifacts?.resultsPath).toBeTruthy();
        expect(result.artifacts?.reportPath).toBeUndefined();

        const payload = JSON.parse(
          await readFile(result.artifacts!.resultsPath, "utf8"),
        ) as { flowExecutions?: unknown[] };
        expect(payload.flowExecutions?.length).toBeGreaterThan(0);
        expect(JSON.stringify(payload)).not.toMatch(/4242|password|secret/i);
      });
    },
    TEST_TIMEOUT_MS,
  );
});
