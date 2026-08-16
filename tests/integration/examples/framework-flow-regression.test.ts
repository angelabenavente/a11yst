import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";
import { createAuditPlan, executeAudit, prepareAuditConfig, selectRuns } from "@a11yst/core";
import { withFlowExampleServer } from "../../helpers/flow-server.js";
import { repoRoot, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const SLOW_TIMEOUT_MS = 240_000;

describe.sequential("framework regression with --routes-only (flows must not break route audits)", () => {
  it(
    "angular-app: adapter selected, routes audited, report generated",
    async () => {
      await withTempDir("a11yst-routes-only-angular-", async (outputDir) => {
        await withFlowExampleServer(
          "examples/frameworks/angular-app",
          async (server) => {
            process.env.PORT = String(server.port);
            const config = await loadConfig({
              cwd: join(repoRoot, "examples/frameworks/angular-app"),
            });
            const result = await executeAudit(config, {
              writeArtifacts: true,
              html: true,
              routesOnly: true,
              outputDir,
            });

            expect(["completed", "completed-with-errors"]).toContain(result.status);
            expect(result.summary.completedRuns).toBeGreaterThan(0);
            expect(result.summary.failedRuns).toBe(0);
            expect(
              result.runs
                .filter((run) => run.status === "completed")
                .every((run) => run.adapter?.adapterId === "angular"),
            ).toBe(true);
          },
          120_000,
        );
      });
    },
    SLOW_TIMEOUT_MS,
  );

  it(
    "nuxt-app: adapter selected, routes audited, report generated",
    async () => {
      await withTempDir("a11yst-routes-only-nuxt-", async (outputDir) => {
        const port = await getFreePort();
        const previousPort = process.env.PORT;
        process.env.PORT = String(port);
        process.env.NUXT_IGNORE_LOCK = "1";
        try {
          const config = await loadConfig({
            cwd: join(repoRoot, "examples/frameworks/nuxt-app"),
          });
          const result = await executeAudit(config, {
            writeArtifacts: true,
            html: true,
            routesOnly: true,
            outputDir,
          });

          expect(["completed", "completed-with-errors"]).toContain(result.status);
          expect(result.summary.completedRuns).toBeGreaterThan(0);
          expect(result.summary.failedRuns).toBe(0);
          expect(
            result.runs
              .filter((run) => run.status === "completed")
              .every((run) => run.adapter?.adapterId === "nuxt"),
          ).toBe(true);
          expect(result.artifacts?.reportPath).toBeTruthy();
        } finally {
          if (previousPort === undefined) delete process.env.PORT;
          else process.env.PORT = previousPort;
        }
      });
    },
    SLOW_TIMEOUT_MS,
  );

  it("flows-only on project without flows selects zero executable runs", async () => {
    const exampleDir = join(repoRoot, "examples/frameworks/html-site");
    const config = await loadConfig({ cwd: exampleDir });
    const plan = createAuditPlan(await prepareAuditConfig(config));
    const { executable } = selectRuns(plan, { flowsOnly: true });
    expect(executable).toHaveLength(0);
  });
});
