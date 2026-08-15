import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createFindingFingerprint } from "../../../packages/browser/src/axe-normalize.js";

const LEGACY_BASELINE = resolve(
  "examples/baseline/legacy-html/.a11yst/baseline.json",
);
const FLOW_BASELINE = resolve(
  "examples/baseline/flow-regression/.a11yst/baseline.json",
);

describe("baseline fingerprint regression", () => {
  it("preserves axe route fingerprints from legacy-html fixture", async () => {
    const raw = await readFile(LEGACY_BASELINE, "utf8");
    const baseline = JSON.parse(raw) as {
      entries: Array<{ fingerprint: string; ruleId: string; projectName: string; snapshot: { target?: string[]; route?: string; profile: string; viewport?: string } }>;
    };

    const expected = [
      "image-alt|baseline-legacy-html|/|default|desktop|#site-logo",
      "button-name|baseline-legacy-html|/|default|desktop|#icon-action",
      "button-name|baseline-legacy-html|/fixed|default|desktop|#fixed-action",
      "label|baseline-legacy-html|/review|default|desktop|#newsletter-input",
      "image-alt|baseline-legacy-html|/archive|default|desktop|#archive-logo",
    ];

    expect(baseline.entries.map((entry) => entry.fingerprint)).toEqual(expected);

    for (const entry of baseline.entries) {
      const recomputed = createFindingFingerprint({
        ruleId: entry.ruleId,
        projectName: entry.projectName,
        route: entry.snapshot.route,
        profile: entry.snapshot.profile,
        viewport: entry.snapshot.viewport,
        target: entry.snapshot.target ?? [],
      });
      expect(recomputed).toBe(entry.fingerprint);
    }
  });

  it("preserves a11yst flow checkpoint fingerprints from flow-regression fixture", async () => {
    const raw = await readFile(FLOW_BASELINE, "utf8");
    const baseline = JSON.parse(raw) as {
      entries: Array<{
        fingerprint: string;
        ruleId: string;
        projectName: string;
        location: { flowId: string; checkpointId: string; profile: string; viewport?: string };
        snapshot: { target?: string[] };
      }>;
    };

    const expected = [
      "dialog-focus-entry::baseline-flow-regression::panel-known::panel-open::default::desktop::#open-known",
      "dialog-focus-entry::baseline-flow-regression::panel-new::panel-open::default::desktop::#open-new",
      "dialog-focus-entry::baseline-flow-regression::panel-resolved::panel-open::default::desktop::#open-resolved",
      "label|baseline-flow-regression|/partial|default|desktop|#confirm-email",
    ];

    expect(baseline.entries.map((entry) => entry.fingerprint)).toEqual(expected);

    for (const entry of baseline.entries) {
      if (entry.fingerprint.includes("|")) {
        const recomputed = createFindingFingerprint({
          ruleId: entry.ruleId,
          projectName: entry.projectName,
          route: "/partial",
          profile: entry.location.profile,
          viewport: entry.location.viewport,
          target: entry.snapshot.target ?? [],
        });
        expect(recomputed).toBe(entry.fingerprint);
        continue;
      }

      const targetKey = (entry.snapshot.target ?? []).join("|") || "document";
      const recomputed = [
        entry.ruleId,
        entry.projectName,
        entry.location.flowId,
        entry.location.checkpointId,
        entry.location.profile,
        entry.location.viewport ?? "",
        targetKey,
      ].join("::");
      expect(recomputed).toBe(entry.fingerprint);
    }
  });

  it("keeps hardcoded known fingerprint values stable", () => {
    expect(
      createFindingFingerprint({
        ruleId: "button-name",
        projectName: "website",
        route: "/",
        profile: "default",
        viewport: "desktop",
        target: ["#icon-button"],
      }),
    ).toBe("button-name|website|/|default|desktop|#icon-button");

    expect(
      createFindingFingerprint({
        ruleId: "image-alt",
        projectName: "baseline-legacy-html",
        route: "/",
        profile: "default",
        viewport: "desktop",
        target: ["#site-logo"],
      }),
    ).toBe("image-alt|baseline-legacy-html|/|default|desktop|#site-logo");
  });
});
