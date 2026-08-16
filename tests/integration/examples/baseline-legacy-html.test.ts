import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";
import { executeAudit } from "@a11yst/core";
import { BASELINE_EXAMPLES } from "../../helpers/baseline.js";
import { startFlowExampleServer, type FlowExampleServer } from "../../helpers/flow-server.js";
import { repoRoot } from "../../helpers/cli.js";

const EXAMPLE = BASELINE_EXAMPLES.legacyHtml;
const SLOW_TIMEOUT_MS = 180_000;

describe.sequential("baseline legacy-html example", () => {
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
    "compares seeded baseline with known, new, resolved, and not-compared findings",
    async () => {
      const result = await audit();

      expect(result.status).toBe("completed");
      expect(result.baselineSummary?.baselineUsed).toBe(true);
      expect(result.baselineSummary?.newFindings).toBe(1);
      expect(result.baselineSummary?.knownFindings).toBe(3);
      expect(result.baselineSummary?.regressedFindings).toBe(0);
      expect(result.baselineSummary?.resolvedFindings).toBe(1);
      expect(result.baselineSummary?.notComparedFindings).toBe(1);

      const byStatus = (status: string) =>
        result.findings.filter((finding) => finding.baseline?.status === status);

      expect(byStatus("new").some((finding) => finding.ruleId === "label" && finding.route === "/contact")).toBe(
        true,
      );
      expect(
        byStatus("known").some(
          (finding) => finding.ruleId === "image-alt" && finding.target?.includes("#site-logo"),
        ),
      ).toBe(true);
      expect(
        byStatus("known").some(
          (finding) =>
            finding.ruleId === "button-name" &&
            finding.baseline?.classification?.disposition === "false-positive",
        ),
      ).toBe(true);
      expect(
        byStatus("known").some(
          (finding) =>
            finding.ruleId === "label" &&
            finding.route === "/review" &&
            finding.baseline?.classification?.disposition === "accepted-risk" &&
            finding.baseline?.classification?.owner === "platform-team",
        ),
      ).toBe(true);
      expect(
        result.resolvedFindings?.some(
          (finding) =>
            finding.ruleId === "button-name" &&
            finding.location.kind === "route" &&
            finding.location.route === "/fixed",
        ),
      ).toBe(true);
      expect(
        result.notComparedFindings?.some(
          (finding) =>
            finding.ruleId === "image-alt" &&
            finding.location.kind === "route" &&
            finding.location.route === "/archive",
        ),
      ).toBe(true);
    },
    SLOW_TIMEOUT_MS,
  );

  it(
    "skips baseline comparison when noBaseline is set",
    async () => {
      const result = await audit({ noBaseline: true });

      expect(result.status).toBe("completed");
      expect(result.baselineSummary).toBeUndefined();
      expect(result.findings.every((finding) => finding.baseline === undefined)).toBe(true);
    },
    SLOW_TIMEOUT_MS,
  );
});
