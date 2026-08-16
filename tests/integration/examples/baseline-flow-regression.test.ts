import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";
import { executeAudit } from "@a11yst/core";
import { BASELINE_EXAMPLES } from "../../helpers/baseline.js";
import { startFlowExampleServer, type FlowExampleServer } from "../../helpers/flow-server.js";
import { repoRoot } from "../../helpers/cli.js";

const EXAMPLE = BASELINE_EXAMPLES.flowRegression;
const SLOW_TIMEOUT_MS = 240_000;

describe.sequential("baseline flow-regression example", () => {
  let shared: FlowExampleServer;
  let stopServer: () => Promise<void>;

  beforeAll(async () => {
    const session = await startFlowExampleServer(EXAMPLE, 120_000);
    shared = session.server;
    stopServer = session.stop;
  }, SLOW_TIMEOUT_MS);

  afterAll(async () => {
    await stopServer();
  }, 30_000);

  async function audit(options: Parameters<typeof executeAudit>[1] = {}) {
    process.env.PORT = String(shared.port);
    const config = await loadConfig({ cwd: join(repoRoot, EXAMPLE) });
    return executeAudit(config, {
      writeArtifacts: false,
      html: false,
      ...options,
    });
  }

  it(
    "full audit compares flow checkpoint findings against the seeded baseline",
    async () => {
      const result = await audit();

      expect(result.status).toBe("completed");
      expect(result.baselineSummary?.baselineUsed).toBe(true);
      expect(result.runs.some((run) => run.profile === "keyboard" && run.status === "completed")).toBe(
        true,
      );
      expect(result.findings.some((finding) => finding.flowId === "panel-known")).toBe(true);
      expect(
        result.findings.some(
          (finding) =>
            finding.flowId === "panel-new" &&
            finding.baseline?.status === "new" &&
            finding.ruleId === "label",
        ),
      ).toBe(true);
      expect(
        result.resolvedFindings?.some(
          (finding) =>
            finding.location.kind === "flow-checkpoint" &&
            finding.location.flowId === "panel-resolved",
        ),
      ).toBe(true);
    },
    SLOW_TIMEOUT_MS,
  );

  it(
    "flows-only checkout-short leaves confirmation checkpoint baseline not compared",
    async () => {
      const result = await audit({
        flowsOnly: true,
        flowNames: ["checkout-short"],
      });

      expect(result.status).toBe("completed");
      expect(result.runs.every((run) => run.kind === "flow-checkpoint")).toBe(true);
      expect(result.baselineSummary?.baselineUsed).toBe(true);
      expect(result.baselineSummary?.notComparedFindings).toBeGreaterThanOrEqual(1);
      expect(
        result.notComparedFindings?.some(
          (finding) =>
            finding.location.kind === "flow-checkpoint" &&
            finding.location.flowId === "checkout-partial" &&
            finding.location.checkpointId === "confirmation",
        ),
      ).toBe(true);
    },
    SLOW_TIMEOUT_MS,
  );
});
