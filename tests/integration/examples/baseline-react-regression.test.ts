import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";
import { executeAudit } from "@a11yst/core";
import {
  BASELINE_EXAMPLES,
  startReactRegressionServer,
} from "../../helpers/baseline.js";
import { getFreePort } from "../../helpers/net.js";
import { repoRoot } from "../../helpers/cli.js";

const EXAMPLE = BASELINE_EXAMPLES.reactRegression;
const SLOW_TIMEOUT_MS = 240_000;

describe.sequential("baseline react-regression variants", () => {
  let port: number;
  let stopServer: () => Promise<void>;

  beforeAll(async () => {
    port = await getFreePort();
    const session = await startReactRegressionServer(port, 120_000);
    stopServer = session.stop;
  }, SLOW_TIMEOUT_MS);

  afterAll(async () => {
    await stopServer();
  }, 30_000);

  async function audit(options: Parameters<typeof executeAudit>[1] = {}) {
    process.env.PORT = String(port);
    const config = await loadConfig({ cwd: join(repoRoot, EXAMPLE) });
    return executeAudit(config, {
      writeArtifacts: false,
      html: false,
      noStartServer: true,
      ...options,
    });
  }

  it(
    "full audit classifies known, new, resolved, and severity regressions across variant routes",
    async () => {
      const result = await audit();

      expect(result.status).toBe("completed");
      expect(result.baselineSummary?.baselineUsed).toBe(true);
      expect(result.baselineSummary?.knownFindings).toBeGreaterThanOrEqual(2);
      expect(result.baselineSummary?.newFindings).toBeGreaterThanOrEqual(1);
      expect(result.baselineSummary?.resolvedFindings).toBe(1);
      expect(result.baselineSummary?.regressedFindings).toBe(1);

      expect(
        result.findings.some(
          (finding) =>
            finding.route === "/v/baseline" &&
            finding.baseline?.status === "known" &&
            finding.ruleId === "button-name",
        ),
      ).toBe(true);
      expect(
        result.findings.some(
          (finding) =>
            finding.route === "/v/new" &&
            finding.baseline?.status === "new" &&
            finding.ruleId === "label",
        ),
      ).toBe(true);
      expect(
        result.resolvedFindings?.some(
          (finding) =>
            finding.location.kind === "route" &&
            finding.location.route === "/v/resolved" &&
            finding.ruleId === "button-name",
        ),
      ).toBe(true);
      expect(
        result.findings.some(
          (finding) =>
            finding.route === "/v/severity" &&
            finding.baseline?.status === "regressed" &&
            finding.baseline?.regressionReason === "severity-increased",
        ),
      ).toBe(true);
    },
    SLOW_TIMEOUT_MS,
  );

  it("loads variant routes from the example config", async () => {
    const config = await loadConfig({ cwd: join(repoRoot, EXAMPLE) });
    const routes = config.projects[0]?.platform === "web" ? config.projects[0].routes : [];
    expect(routes.map((route) => route.path)).toEqual(
      expect.arrayContaining(["/v/baseline", "/v/new", "/v/resolved", "/v/severity"]),
    );
  });
});
