import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";
import { executeAudit } from "@a11yst/core";
import { BASELINE_EXAMPLES } from "../../helpers/baseline.js";
import { startFlowExampleServer, type FlowExampleServer } from "../../helpers/flow-server.js";
import { repoRoot } from "../../helpers/cli.js";

const EXAMPLE = BASELINE_EXAMPLES.mixedWorkspace;
const WEB_SERVER = `${EXAMPLE}/apps/web`;
const SLOW_TIMEOUT_MS = 180_000;

describe.sequential("baseline mixed-workspace example", () => {
  let shared: FlowExampleServer;
  let stopServer: () => Promise<void>;

  beforeAll(async () => {
    const session = await startFlowExampleServer(WEB_SERVER, 120_000);
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

  it("loads the web project from the workspace config", async () => {
    const config = await loadConfig({ cwd: join(repoRoot, EXAMPLE) });
    expect(config.projects).toHaveLength(1);
    expect(config.projects.some((project) => project.name === "baseline-mixed-web")).toBe(true);
  });

  it(
    "audits the web project and compares against the web-only baseline",
    async () => {
      const result = await audit();

      expect(result.status).toBe("completed");
      expect(result.baselineSummary?.baselineUsed).toBe(true);

      const webRuns = result.runs.filter((run) => run.projectName === "baseline-mixed-web");

      expect(webRuns.some((run) => run.status === "completed")).toBe(true);
      expect(result.runs.every((run) => run.projectName === "baseline-mixed-web")).toBe(true);

      expect(result.findings.every((finding) => finding.projectName === "baseline-mixed-web")).toBe(
        true,
      );
      expect(
        result.findings.some(
          (finding) =>
            finding.projectName === "baseline-mixed-web" &&
            finding.baseline?.status === "known" &&
            finding.ruleId === "button-name",
        ),
      ).toBe(true);
    },
    SLOW_TIMEOUT_MS,
  );
});
