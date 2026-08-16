import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { executeAudit } from "@a11yst/core";
import { loadFlowExampleConfig } from "../../helpers/flows.js";
import { startFlowExampleServer, type FlowExampleServer } from "../../helpers/flow-server.js";

const EXAMPLE = "examples/flows/mixed-workspace";
const TEST_TIMEOUT_MS = 120_000;
const FULL_AUDIT_TIMEOUT_MS = 240_000;

describe.sequential("mixed-workspace flow example", () => {
  let shared: FlowExampleServer;
  let stopServer: () => Promise<void>;

  beforeAll(async () => {
    const session = await startFlowExampleServer("examples/flows/mixed-workspace/apps/web", 120_000);
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

  it("loads the web project from the workspace config", async () => {
    const config = await loadFlowExampleConfig(EXAMPLE);
    expect(config.projects).toHaveLength(1);
    expect(config.projects.some((project) => project.platform === "web")).toBe(true);
    expect(config.projects.some((project) => project.name === "flows-mixed-web")).toBe(true);
  });

  it(
    "audits the web flow without treating the run as a finding",
    async () => {
      const result = await audit({});

      expect(result.status).toBe("completed");

      const webRuns = result.runs.filter((run) => run.platform === "web");

      expect(webRuns.some((run) => run.kind === "flow-checkpoint")).toBe(true);
      expect(webRuns.some((run) => run.status === "completed")).toBe(true);
      expect(result.runs.every((run) => run.platform === "web")).toBe(true);

      expect(result.findings.every((finding) => finding.projectName === "flows-mixed-web")).toBe(
        true,
      );
      expect(result.flowSummary?.configuredFlows).toBe(1);
    },
    FULL_AUDIT_TIMEOUT_MS,
  );

  it(
    "flows-only completes web panel flow without planning route runs",
    async () => {
      const result = await audit({ flowsOnly: true });

      expect(result.runs.every((run) => run.platform === "web")).toBe(true);
      expect(result.runs.filter((run) => run.kind === "flow-checkpoint").length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS,
  );
});
