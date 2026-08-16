import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compareBaselineWithAudit, loadBaselineFile } from "@a11yst/baseline";
import { loadConfig } from "@a11yst/config";
import { executeAudit } from "@a11yst/core";
import { BASELINE_EXAMPLES } from "../../helpers/baseline.js";
import { startFlowExampleServer, type FlowExampleServer } from "../../helpers/flow-server.js";
import { repoRoot } from "../../helpers/cli.js";

const EXAMPLE = BASELINE_EXAMPLES.classificationExpiry;
const SLOW_TIMEOUT_MS = 180_000;

describe.sequential("baseline classification-expiry example", () => {
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
    "surfaces classification-expired regression for pre-seeded expired accepted-risk entry",
    async () => {
      const result = await audit();

      expect(result.status).toBe("completed");
      expect(result.baselineSummary?.baselineUsed).toBe(true);
      expect(result.baselineSummary?.expiredClassifications).toBe(1);
      expect(result.baselineSummary?.regressedFindings).toBe(1);

      const expired = result.findings.find(
        (finding) =>
          finding.target?.includes("#ar-expired-btn") &&
          finding.baseline?.regressionReason === "classification-expired",
      );
      expect(expired).toBeTruthy();
      expect(expired?.baseline?.classificationExpired).toBe(true);

      const valid = result.findings.find((finding) => finding.target?.includes("#ar-valid-btn"));
      expect(valid?.baseline?.status).toBe("known");
      expect(valid?.baseline?.regressionReason).toBeUndefined();
    },
    SLOW_TIMEOUT_MS,
  );

  it(
    "keeps third-party, not-applicable, and manual-review classifications visible as known findings",
    async () => {
      const result = await audit();

      expect(result.status).toBe("completed");

      const knownWithDisposition = (target: string, disposition: string) =>
        result.findings.find(
          (finding) =>
            finding.target?.includes(target) &&
            finding.baseline?.status === "known" &&
            finding.baseline?.classification?.disposition === disposition,
        );

      expect(knownWithDisposition("#tp-input", "third-party")).toBeTruthy();
      expect(knownWithDisposition("#na-input", "not-applicable")).toBeTruthy();
      expect(knownWithDisposition("#mr-input", "manual-review")).toBeTruthy();
      expect(knownWithDisposition("#fp-logo", "false-positive")).toBeTruthy();
    },
    SLOW_TIMEOUT_MS,
  );

  it(
    "recomputes expiry with an injectable clock against the pre-seeded baseline file",
    async () => {
      const result = await audit({ writeArtifacts: false, html: false });
      const baseline = await loadBaselineFile(join(repoRoot, EXAMPLE, ".a11yst/baseline.json"));

      const beforeExpiry = compareBaselineWithAudit(baseline, result, {
        baselinePath: ".a11yst/baseline.json",
        applyClassifications: true,
        clock: { now: () => new Date("2019-06-01T12:00:00.000Z") },
      });
      expect(beforeExpiry.summary.regressedFindings).toBe(0);
      expect(beforeExpiry.summary.expiredClassifications).toBe(0);

      const afterExpiry = compareBaselineWithAudit(baseline, result, {
        baselinePath: ".a11yst/baseline.json",
        applyClassifications: true,
        clock: { now: () => new Date("2026-08-04T12:00:00.000Z") },
      });
      expect(afterExpiry.summary.regressedFindings).toBe(1);
      expect(afterExpiry.summary.expiredClassifications).toBe(1);
    },
    SLOW_TIMEOUT_MS,
  );
});
