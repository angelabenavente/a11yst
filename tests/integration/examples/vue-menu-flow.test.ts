import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { executeAudit } from "@a11yst/core";
import { loadFlowExampleConfig } from "../../helpers/flows.js";
import { startFlowExampleServer, type FlowExampleServer } from "../../helpers/flow-server.js";

const EXAMPLE = "examples/flows/vue-menu";
const TEST_TIMEOUT_MS = 120_000;

describe.sequential("vue-menu flow example", () => {
  let shared: FlowExampleServer;
  let stopServer: () => Promise<void>;

  beforeAll(async () => {
    const session = await startFlowExampleServer(EXAMPLE, 60_000);
    shared = session.server;
    stopServer = session.stop;
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await stopServer();
  }, 30_000);

  async function audit(options: Parameters<typeof executeAudit>[1]) {
    process.env.PORT = String(shared.port);
    const config = await loadFlowExampleConfig(EXAMPLE);
    return await executeAudit(config, options);
  }

  it(
    "accessible menu flow opens, checkpoints, closes with Escape, and preserves Vue adapter",
    async () => {
      const result = await audit({
        flowsOnly: true,
        flowNames: ["menu-open-close"],
        profileNames: ["default"],
      });

      expect(result.status).toBe("completed");
      expect(result.summary.failedRuns).toBe(0);

      const flowRuns = result.runs.filter((run) => run.kind === "flow-checkpoint");
      expect(flowRuns.length).toBe(2);
      expect(flowRuns.every((run) => run.adapter?.adapterId === "vue")).toBe(true);
      expect(flowRuns.every((run) => run.status === "completed")).toBe(true);

      expect(
        result.findings.filter(
          (finding) =>
            finding.flowId === "menu-open-close" && finding.ruleId === "dialog-focus-entry",
        ),
      ).toHaveLength(0);

      expect(result.flowExecutions?.some((trace) => trace.flowId === "menu-open-close")).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "bad menu flow completes checkpoints and may surface focus or dialog findings",
    async () => {
      const result = await audit({
        flowsOnly: true,
        flowNames: ["menu-open-close-bad"],
        profileNames: ["default"],
      });

      expect(result.status).toBe("completed");
      const badRuns = result.runs.filter((run) => run.flowId === "menu-open-close-bad");
      expect(badRuns.every((run) => run.status === "completed")).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "keyboard profile completes accessible menu flow",
    async () => {
      const result = await audit({
        flowsOnly: true,
        flowNames: ["menu-open-close"],
        profileNames: ["keyboard"],
      });

      expect(
        result.runs.filter((run) => run.profile === "keyboard").every((run) => run.status === "completed"),
      ).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );
});
