import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { executeAudit } from "@a11yst/core";
import { loadFlowExampleConfig } from "../../helpers/flows.js";
import { startFlowExampleServer, type FlowExampleServer } from "../../helpers/flow-server.js";

const EXAMPLE = "examples/flows/next-navigation";
const SLOW_TIMEOUT_MS = 240_000;

describe.sequential("next-navigation flow example", () => {
  let shared: FlowExampleServer;
  let stopServer: () => Promise<void>;

  beforeAll(async () => {
    const session = await startFlowExampleServer(EXAMPLE, 180_000);
    shared = session.server;
    stopServer = session.stop;
  }, SLOW_TIMEOUT_MS);

  afterAll(async () => {
    await stopServer();
  }, 30_000);

  async function audit(options: Parameters<typeof executeAudit>[1]) {
    process.env.PORT = String(shared.port);
    const config = await loadFlowExampleConfig(EXAMPLE);
    return await executeAudit(config, options);
  }

  it(
    "accessible SPA navigation updates URL and completes checkpoints with Next adapter",
    async () => {
      const result = await audit({
        flowsOnly: true,
        flowNames: ["navigate-between-pages"],
        profileNames: ["default"],
      });

      expect(result.status).toBe("completed");
      expect(result.summary.failedRuns).toBe(0);

      const flowRuns = result.runs.filter((run) => run.kind === "flow-checkpoint");
      expect(flowRuns.length).toBeGreaterThanOrEqual(2);
      expect(flowRuns.every((run) => run.adapter?.adapterId === "next")).toBe(true);
      expect(flowRuns.every((run) => run.status === "completed")).toBe(true);

      expect(result.flowExecutions?.some((trace) => trace.flowId === "navigate-between-pages")).toBe(
        true,
      );
    },
    SLOW_TIMEOUT_MS,
  );

  it(
    "bad navigation flow triggers route-change-focus-review",
    async () => {
      const result = await audit({
        flowsOnly: true,
        flowNames: ["navigate-between-pages-bad"],
        profileNames: ["default"],
      });

      expect(result.status).toBe("completed");
      expect(
        result.findings.some(
          (finding) =>
            finding.ruleId === "route-change-focus-review" &&
            finding.flowId === "navigate-between-pages-bad",
        ),
      ).toBe(true);
    },
    SLOW_TIMEOUT_MS,
  );

  it(
    "keyboard profile completes on accessible navigation flow",
    async () => {
      const result = await audit({
        flowsOnly: true,
        flowNames: ["navigate-between-pages"],
        profileNames: ["keyboard"],
      });

      expect(
        result.runs.filter((run) => run.profile === "keyboard").every((run) => run.status === "completed"),
      ).toBe(true);
    },
    SLOW_TIMEOUT_MS,
  );
});
