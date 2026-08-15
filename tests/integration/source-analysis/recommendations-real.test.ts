import { describe, expect, it } from "vitest";
import { findingBuilders, runRealAnalysis } from "./fixtures.js";

describe("recommendations on real fixtures", () => {
  it("returns specific, manual-review, and unsupported recommendations", async () => {
    const result = await runRealAnalysis(
      [
        findingBuilders.htmlSubmitMapped(),
        findingBuilders.htmlImageAlt(),
        findingBuilders.vueDialogMapped(),
        findingBuilders.unsupportedRule(),
        findingBuilders.nextSharedAmbiguous(),
      ],
      { ranking: false, recommendations: true },
    );

    const button = result.findings.find((f) => f.id === "html-submit");
    expect(button?.recommendations?.status).toBe("recommended");
    expect(button?.recommendations?.recommendations[0]?.ruleId).toBe("button-name");
    expect(button?.recommendations?.recommendations[0]?.actions.length).toBeGreaterThan(0);
    expect(button?.recommendations?.recommendations[0]?.verification.length).toBeGreaterThan(0);
    expect(button?.recommendations?.recommendations[0]?.examples.every((e) => e.generic)).toBe(true);

    const image = result.findings.find((f) => f.id === "html-image");
    expect(image?.recommendations?.status).toBe("manual-review");

    const dialog = result.findings.find((f) => f.id === "vue-dialog");
    expect(dialog?.recommendations?.status).toBe("manual-review");

    const unsupported = result.findings.find((f) => f.id === "unsupported-rule");
    expect(unsupported?.recommendations?.status).toBe("unsupported");

    const ambiguous = result.findings.find((f) => f.id === "next-shared");
    expect(ambiguous?.recommendations?.recommendations[0]?.target.status).not.toBe("source");

    for (const finding of result.findings) {
      const text = JSON.stringify(finding.recommendations);
      expect(text.toLowerCase()).not.toContain("patch");
    }
  });
});
