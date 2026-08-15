import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadProfileEvidenceForReport,
  renderFocusSequenceBlock,
  renderLargeTextComparisonBlock,
  renderProfileEvidenceSection,
} from "@a11yst/reporters";
import type { AuditRunResult, FocusStep } from "@a11yst/types";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      import("node:fs/promises").then(({ rm }) =>
        rm(directory, { recursive: true, force: true }),
      ),
    ),
  );
});

function keyboardRun(overrides: Partial<AuditRunResult> = {}): AuditRunResult {
  return {
    runId: "run-keyboard",
    projectName: "demo",
    platform: "web",
    framework: "html",
    routeId: "home",
    routeName: "Home",
    route: "/",
    profile: "keyboard",
    viewport: { name: "desktop", width: 1280, height: 800 },
    status: "completed",
    startedAt: "2026-08-04T10:00:00.000Z",
    durationMs: 1000,
    findings: [],
    diagnostics: [],
    ...overrides,
  };
}

describe("profile evidence report rendering", () => {
  it("renders a complete forward and backward focus sequence table", () => {
    const forwardSteps: FocusStep[] = [
      {
        index: 0,
        direction: "forward",
        target: ["button.primary"],
        role: "button",
        accessibleName: "Continue",
        visible: true,
        inViewport: true,
        tabindex: 0,
      },
      {
        index: 1,
        direction: "forward",
        visible: false,
        inViewport: false,
      },
    ];
    const backwardSteps: FocusStep[] = [
      {
        index: 0,
        direction: "backward",
        target: ["button.primary"],
        role: "button",
        accessibleName: "Continue",
        visible: true,
        inViewport: true,
      },
    ];

    const html = renderFocusSequenceBlock(keyboardRun(), {
      forwardSteps,
      backwardSteps,
      stopReason: "focus-lost",
    });

    expect(html).toContain("Keyboard focus sequence");
    expect(html).toContain("Forward Tab sequence");
    expect(html).toContain("Backward Shift+Tab sample");
    expect(html).toContain("button.primary");
    expect(html).toContain("focus-lost");
    expect(html).toContain("(no active element)");
  });

  it("renders large-text before and after screenshots with dimensions", () => {
    const html = renderLargeTextComparisonBlock(
      keyboardRun({
        runId: "run-large-text",
        profile: "large-text",
        profileMetadata: { strategy: "injected-text-scale", scale: 2 },
      }),
      {
        beforeScreenshot: "evidence/demo/home/default/desktop/page.png",
        afterScreenshot: "evidence/demo/home/large-text/desktop/page.png",
        layoutComparison: {
          baseline: {
            profile: "default",
            url: "http://127.0.0.1/",
            capturedAt: "2026-08-04T10:00:00.000Z",
            clientWidth: 1280,
            clientHeight: 800,
            scrollWidth: 1280,
            scrollHeight: 800,
          },
          scaled: {
            profile: "large-text",
            url: "http://127.0.0.1/",
            capturedAt: "2026-08-04T10:00:01.000Z",
            clientWidth: 1280,
            clientHeight: 900,
            scrollWidth: 1400,
            scrollHeight: 900,
          },
        },
      },
    );

    expect(html).toContain("Large-text layout comparison");
    expect(html).toContain("Default profile (before)");
    expect(html).toContain("Large text at 200% (after)");
    expect(html).toContain("../evidence/demo/home/default/desktop/page.png");
    expect(html).toContain("scroll 1400×900px");
  });

  it("loads structured evidence JSON from the audit bundle", async () => {
    const root = await mkdtemp(join(tmpdir(), "a11yst-report-evidence-"));
    temporaryDirectories.push(root);

    const evidencePath = join(
      "evidence",
      "demo",
      "home",
      "keyboard",
      "desktop",
      "focus-sequence.json",
    );
    await mkdir(join(root, "evidence", "demo", "home", "keyboard", "desktop"), {
      recursive: true,
    });
    await writeFile(
      join(root, evidencePath),
      JSON.stringify({
        forwardSteps: [{ index: 0, direction: "forward", visible: true, inViewport: true }],
        backwardSteps: [],
        stopReason: "completed",
      }),
      "utf8",
    );

    const run = keyboardRun({
      profileEvidence: [{ kind: "focus-sequence", path: evidencePath }],
    });
    const loaded = await loadProfileEvidenceForReport(root, [run]);

    expect(loaded.get(run.runId)?.focusSequence?.stopReason).toBe("completed");
    const section = renderProfileEvidenceSection([run], loaded);
    expect(section).toContain("Keyboard focus sequence");
  });
});
