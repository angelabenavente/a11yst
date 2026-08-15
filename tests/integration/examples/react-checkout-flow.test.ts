import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { executeAudit } from "@a11yst/core";
import { loadFlowExampleConfig } from "../../helpers/flows.js";
import { startFlowExampleServer, type FlowExampleServer } from "../../helpers/flow-server.js";

const EXAMPLE = "examples/flows/react-checkout";
const SLOW_TIMEOUT_MS = 180_000;

describe.sequential("react-checkout flow example", () => {
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

  async function audit(options: Parameters<typeof executeAudit>[1]) {
    process.env.PORT = String(shared.port);
    const config = await loadFlowExampleConfig(EXAMPLE);
    return executeAudit(config, options);
  }

  it(
    "open-cart: completes with dialog-focus-entry and axe findings at cart checkpoint",
    async () => {
      const result = await audit({
        flowNames: ["open-cart"],
        profileNames: ["default"],
      });

      expect(result.status).toBe("completed");
      expect(result.summary.failedRuns).toBe(0);

      const cartRuns = result.runs.filter(
        (run) => run.flowId === "open-cart" && run.checkpointId === "cart-drawer-open",
      );
      expect(cartRuns).toHaveLength(1);
      expect(cartRuns[0]?.status).toBe("completed");

      const a11yst = result.findings.filter((finding) => finding.source === "a11yst");
      expect(a11yst.some((finding) => finding.ruleId === "dialog-focus-entry")).toBe(true);

      const axe = result.findings.filter((finding) => finding.source === "axe");
      expect(axe.length).toBeGreaterThan(0);

      expect(result.flowExecutions?.some((trace) => trace.flowId === "open-cart")).toBe(true);
    },
    SLOW_TIMEOUT_MS,
  );

  it(
    "checkout-validation-errors: surfaces form-error-focus-review with keyboard profile",
    async () => {
      const result = await audit({
        flowNames: ["checkout-validation-errors"],
        profileNames: ["keyboard"],
      });

      expect(result.status).toBe("completed");
      expect(
        result.findings.some(
          (finding) =>
            finding.ruleId === "form-error-focus-review" &&
            finding.flowId === "checkout-validation-errors",
        ),
      ).toBe(true);
    },
    SLOW_TIMEOUT_MS,
  );

  it(
    "successful-checkout: completes order confirmation checkpoint",
    async () => {
      const result = await audit({
        flowNames: ["successful-checkout"],
        profileNames: ["default"],
      });

      expect(result.status).toBe("completed");
      const confirmation = result.runs.find((run) => run.checkpointId === "order-confirmation");
      expect(confirmation?.status).toBe("completed");
    },
    SLOW_TIMEOUT_MS,
  );

  it(
    "large-text uses internal default reference without duplicating default runs or findings",
    async () => {
      const result = await audit({
        flowNames: ["open-cart"],
        profileNames: ["large-text"],
      });

      expect(result.status).toBe("completed");
      expect(
        result.runs.filter((run) => run.profile === "default" && run.kind === "flow-checkpoint"),
      ).toHaveLength(0);

      const largeTextRun = result.runs.find((run) => run.profile === "large-text");
      expect(largeTextRun?.profileMetadata?.internalReferenceProfile).toBe("default");
      expect(result.diagnostics.some((entry) => entry.code === "INTERNAL_DEFAULT_BASELINE")).toBe(
        true,
      );
      expect(result.findings.filter((finding) => finding.profile === "default")).toHaveLength(0);
      expect(result.summary.completedRuns).toBe(1);
    },
    SLOW_TIMEOUT_MS,
  );

  it(
    "reduced-motion uses internal default reference at the same checkpoint",
    async () => {
      const result = await audit({
        flowNames: ["open-cart"],
        profileNames: ["reduced-motion"],
      });

      expect(result.status).toBe("completed");
      const motionRun = result.runs.find((run) => run.profile === "reduced-motion");
      expect(motionRun?.checkpointId).toBe("cart-drawer-open");
      expect(motionRun?.profileMetadata?.internalReferenceProfile).toBe("default");
    },
    SLOW_TIMEOUT_MS,
  );
});
