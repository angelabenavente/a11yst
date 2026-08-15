import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";
import { executeAudit } from "@a11yst/core";
import type { AccessibilityProfile } from "@a11yst/types";
import { repoRoot } from "../../helpers/cli.js";

const TEST_TIMEOUT_MS = 120_000;

interface ProfileExampleSpec {
  dirName: string;
  port: number;
  profile: AccessibilityProfile;
  expectedRuns: number;
  expectedA11ystRules: string[];
}

const PROFILE_EXAMPLES: ProfileExampleSpec[] = [
  {
    dirName: "keyboard",
    port: 6211,
    profile: "keyboard",
    expectedRuns: 2,
    expectedA11ystRules: ["keyboard-positive-tabindex"],
  },
  {
    dirName: "large-text",
    port: 6212,
    profile: "large-text",
    expectedRuns: 4,
    expectedA11ystRules: ["large-text-overlap"],
  },
  {
    dirName: "reduced-motion",
    port: 6213,
    profile: "reduced-motion",
    expectedRuns: 4,
    expectedA11ystRules: ["reduced-motion-infinite-animation"],
  },
];

async function runProfileExampleAudit(
  example: ProfileExampleSpec,
  options?: Parameters<typeof executeAudit>[1],
) {
  const exampleDir = join(repoRoot, "examples/profiles", example.dirName);
  const previousPort = process.env.PORT;
  process.env.PORT = String(example.port);
  try {
    const config = await loadConfig({ cwd: exampleDir });
    return await executeAudit(config, {
      writeArtifacts: false,
      profileNames: [example.profile],
      ...options,
    });
  } finally {
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }
  }
}

describe.sequential("profile browser audits (real Chromium + dev servers)", () => {
  for (const example of PROFILE_EXAMPLES) {
    it(
      `${example.dirName}: completes with a11yst profile findings (--profile ${example.profile})`,
      async () => {
        const result = await runProfileExampleAudit(example);

        expect(result.status).toBe("completed");
        expect(result.summary.failedRuns).toBe(0);
        expect(result.summary.completedRuns).toBe(example.expectedRuns);
        expect(result.summary.plannedRuns).toBe(example.expectedRuns);
        expect(result.runs.every((run) => run.profile === example.profile)).toBe(true);
        expect(result.runs.every((run) => run.status === "completed")).toBe(true);

        const a11ystFindings = result.findings.filter((finding) => finding.source === "a11yst");
        expect(a11ystFindings.length).toBeGreaterThan(0);

        const ruleIds = new Set(a11ystFindings.map((finding) => finding.ruleId));
        for (const ruleId of example.expectedA11ystRules) {
          expect(ruleIds).toContain(ruleId);
        }

        expect(result.profileSummary).toBeDefined();
        expect(result.profileSummary?.completed).toContain(example.profile);
        expect(result.profileSummary?.findingsBySource.a11yst).toBeGreaterThan(0);
      },
      TEST_TIMEOUT_MS,
    );
  }
});
