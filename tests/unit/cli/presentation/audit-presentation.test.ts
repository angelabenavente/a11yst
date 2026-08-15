import { describe, expect, it } from "vitest";
import { formatAuditHuman } from "../../../../packages/cli/src/commands/audit.js";
import { resolveTerminalCapabilities } from "../../../../packages/cli/src/presentation/capabilities.js";
import {
  groupFindings,
  countUniqueIssues,
} from "../../../../packages/cli/src/presentation/audit-presentation.js";
import { resolveColorEnabled } from "../../../../packages/cli/src/presentation/color.js";
import { resolveTerminalPresentationMode } from "../../../../packages/cli/src/presentation/mode.js";
import {
  createAuditDogfoodFixture,
  createAuditExecutionFailedFixture,
} from "../../../fixtures/cli/audit-dogfood-presentation.js";

const plainCaps = resolveTerminalCapabilities({
  isTTY: false,
  isCI: false,
  term: "dumb",
  noColor: false,
});

const ttyCaps = resolveTerminalCapabilities({
  isTTY: true,
  isCI: false,
  term: "xterm-256color",
  noColor: false,
});

const noColorCaps = resolveTerminalCapabilities({
  isTTY: true,
  isCI: false,
  term: "xterm-256color",
  noColor: true,
});

function formatPlain(result: Parameters<typeof formatAuditHuman>[0], verbose = false): string {
  return formatAuditHuman(result, {
    capabilities: plainCaps,
    presentationMode: "plain",
    colorMode: "never",
    terminalWidth: 80,
    verbose,
  });
}

describe("audit human-first presentation", () => {
  it("groups dogfood findings into two unique issues without repeating link-name blocks", () => {
    const fixture = createAuditDogfoodFixture();
    const groups = groupFindings(fixture.findings);
    expect(groups).toHaveLength(2);
    expect(countUniqueIssues(fixture.findings)).toBe(2);

    const output = formatPlain(fixture);
    const linkNameBlocks = output.match(/Links must have discernible text/g) ?? [];
    expect(linkNameBlocks.length).toBeLessThanOrEqual(2);
    expect(output).toContain("select-name");
    expect(output).toContain("link-name");
    expect(output).toContain("Unique issues       2");
    expect(output).toContain("Affected elements   6");
    expect(output).toContain("Critical            1");
    expect(output).toContain("High                5");
  });

  it("uses SUCCESS/ISSUES wording for completed runs with barriers, not FAIL", () => {
    const output = formatPlain(createAuditDogfoodFixture());
    expect(output).toContain("Execution   SUCCESS");
    expect(output).toContain("Accessibility  6 barriers found");
    expect(output).toContain("ISSUES  5 automated barriers");
    expect(output).not.toMatch(/FAIL\s+\d+\s+automated barrier/);
  });

  it("uses ERROR/FAILED for technical execution failures", () => {
    const output = formatPlain(createAuditExecutionFailedFixture());
    expect(output).toContain("Execution   FAILED");
    expect(output).toContain("ERROR  /broken");
    expect(output).toContain("Page did not load");
  });

  it("shows severity as text labels in plain output", () => {
    const output = formatPlain(createAuditDogfoodFixture());
    expect(output).toContain("CRITICAL");
    expect(output).toContain("HIGH");
    // eslint-disable-next-line no-control-regex
    expect(output).not.toMatch(/\x1b\[[0-9;]*m/);
  });

  it("enables ANSI with color always on TTY capabilities", () => {
    const output = formatAuditHuman(createAuditDogfoodFixture(), {
      capabilities: ttyCaps,
      presentationMode: "interactive",
      colorMode: "always",
      terminalWidth: 120,
    });
    // eslint-disable-next-line no-control-regex
    expect(output).toMatch(/\x1b\[[0-9;]*m/);
    expect(output).toContain("CRITICAL");
  });

  it("respects NO_COLOR even when color mode is always", () => {
    expect(resolveColorEnabled("always", noColorCaps)).toBe(false);
    const output = formatAuditHuman(createAuditDogfoodFixture(), {
      capabilities: noColorCaps,
      presentationMode: "interactive",
      colorMode: "always",
      terminalWidth: 120,
    });
    // eslint-disable-next-line no-control-regex
    expect(output).not.toMatch(/\x1b\[[0-9;]*m/);
  });

  it("disables ANSI for pipe/plain presentation", () => {
    expect(resolveColorEnabled("auto", plainCaps)).toBe(false);
    expect(resolveTerminalPresentationMode(plainCaps)).toBe("plain");
  });

  it("shows likely source and recommendations without hiding DOM targets", () => {
    const output = formatPlain(createAuditDogfoodFixture());
    expect(output).toContain("Likely source");
    expect(output).toContain("LanguageSelector.jsx:24");
    expect(output).toContain("SocialLinks.jsx:18");
    expect(output).toContain("Recommendation");
    expect(output).toContain("Provide visible link text or aria-label");
  });

  it("includes technical provenance in verbose mode without provider-centric default labels", () => {
    const fixture = createAuditDogfoodFixture();
    fixture.findings[1]!.failureSummary = "Fix all of the following: Element has no accessible name";
    fixture.findings[1]!.sourceImpact = "serious";

    const output = formatPlain(fixture, true);
    expect(output).toContain("Verbose details");
    expect(output).toContain("Technical provenance");
    expect(output).toContain("Engine         axe-core");
    expect(output).toContain("Source impact  serious");
    expect(output).toContain("Failure summary:");
    expect(output).toContain("a.social-link-1");
    expect(output).not.toContain("Axe impact:");
  });

  it("does not expose provider split or source impact in default output", () => {
    const fixture = createAuditDogfoodFixture();
    fixture.findings[1]!.sourceImpact = "serious";
    const output = formatPlain(fixture);
    expect(output).not.toMatch(/Findings \(axe\)/i);
    expect(output).not.toMatch(/Findings \(a11yst\)/i);
    expect(output).not.toContain("Axe impact:");
    expect(output).not.toContain("axe-core");
    expect(output).not.toContain("serious");
  });

  it("separates manual review terminology in profile coverage", () => {
    const fixture = createAuditDogfoodFixture({
      profileSummary: {
        completed: ["default"],
        failed: [],
        skipped: [],
        coverage: [
          {
            profile: "default",
            status: "completed",
            automatedChecks: ["Browser accessibility checks completed"],
            heuristicChecks: [],
            manualChecks: ["Color contrast review"],
            limitations: [],
            a11ystRulesExecuted: [],
            axeExecuted: true,
          },
        ],
        findingsBySource: { axe: 6, a11yst: 0 },
        findingsByAutomation: { automated: 6, heuristic: 0, "manual-review": 0 },
        findingsByConfidence: { high: 6, medium: 0, low: 0 },
        manualReviewPending: 0,
      },
    });
    const output = formatPlain(fixture);
    expect(output).toContain("Automated findings");
    expect(output).toContain("Heuristic findings");
    expect(output).toContain("Generated manual checks");
    expect(output).toContain("Automated checks completed");
    expect(output).toContain("Manual accessibility review still required");
    expect(output).not.toContain("Manual review pending");
    expect(output).not.toContain("Manual review still required");
  });

  it("renders wide summary table columns on interactive terminals", () => {
    const output = formatAuditHuman(createAuditDogfoodFixture(), {
      capabilities: ttyCaps,
      presentationMode: "interactive",
      colorMode: "never",
      terminalWidth: 120,
    });
    expect(output).toContain("Severity");
    expect(output).toContain("Rule");
    expect(output).toContain("Affected");
    expect(output).toContain("Route/Source");
  });

  it("renders a compact representative snapshot", () => {
    const output = formatPlain(createAuditDogfoodFixture());
    expect(output).toMatchInlineSnapshot(`
      "Running accessibility audit.

      Project     demo
      Framework   react
      Target      http://127.0.0.1:5173
      Browser     chromium
      Mode        headless
      Routes      2
      Planned runs2

      Execution   SUCCESS
      Accessibility  6 barriers found

      Summary

      CRITICAL  select-name  1  src/components/LanguageSelector.jsx:24:7
      HIGH  link-name  5  src/components/SocialLinks.jsx:18:6 +4

      Issues

      CRITICAL  select-name
      Select element must have an accessible name
      Affected elements: 1

      Affected elements
        1. Likely source  src/components/LanguageSelector.jsx:24:7  (/settings)

      Recommendation
        Associate a label with the select
        Use a visible <label> or aria-label on the language selector.

      HIGH  link-name
      Links must have discernible text
      Affected elements: 5

      Affected elements
        1. Likely source  src/components/SocialLinks.jsx:18:6  (/)
        2. Likely source  src/components/SocialLinks.jsx:18:7  (/)
        3. Likely source  src/components/SocialLinks.jsx:18:8  (/)
        4. Likely source  src/components/SocialLinks.jsx:18:9  (/)
        5. Likely source  src/components/SocialLinks.jsx:18:10  (/)

      Recommendation
        Provide visible link text or aria-label
        Ensure each social link exposes an accessible name via visible text or aria-label.

      RUN   /settings            default          desktop
      ISSUES  1 automated barrier

      RUN   /                    default          desktop
      ISSUES  5 automated barriers

      Summary

      Routes              2
      Profiles            1
      Viewports           1
      Unique issues       2
      Affected elements   6

      Critical            1
      High                5

      Planned             2
      Completed           2
      Skipped             0
      Failed runs         0"
    `);
  });
});

describe("audit presentation color contract", () => {
  it("documents auto vs always vs never behavior", () => {
    expect(resolveColorEnabled("auto", ttyCaps)).toBe(true);
    expect(resolveColorEnabled("auto", plainCaps)).toBe(false);
    expect(resolveColorEnabled("always", plainCaps)).toBe(true);
    expect(resolveColorEnabled("never", ttyCaps)).toBe(false);
    expect(resolveColorEnabled("always", noColorCaps)).toBe(false);
  });
});
