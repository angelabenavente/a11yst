import { describe, expect, it } from "vitest";
import {
  type AxeViolationLike,
  createFindingFingerprint,
  createFindingId,
  mapAxeImpactToSeverity,
  normalizeAxeViolations,
  sanitizeHtmlSnippet,
  sortFindings,
} from "@a11yst/browser";
import type { Finding } from "@a11yst/types";

describe("mapAxeImpactToSeverity", () => {
  it("maps axe critical", () => {
    expect(mapAxeImpactToSeverity("critical")).toBe("critical");
  });

  it("maps axe serious to canonical high", () => {
    expect(mapAxeImpactToSeverity("serious")).toBe("high");
  });

  it("maps axe moderate to canonical medium", () => {
    expect(mapAxeImpactToSeverity("moderate")).toBe("medium");
  });

  it("maps axe minor", () => {
    expect(mapAxeImpactToSeverity("minor")).toBe("minor");
  });

  it("defaults to medium when impact is undefined", () => {
    expect(mapAxeImpactToSeverity(undefined)).toBe("medium");
  });

  it("defaults to medium when impact is null", () => {
    expect(mapAxeImpactToSeverity(null)).toBe("medium");
  });

  it("defaults to medium for an unknown impact string", () => {
    expect(mapAxeImpactToSeverity("catastrophic")).toBe("medium");
  });
});

const baseContext = {
  projectName: "website",
  profile: "default" as const,
  routeId: "home",
  routeName: "Home",
  route: "/",
  url: "http://127.0.0.1:4177/",
  viewport: "desktop",
};

function violation(overrides: Partial<AxeViolationLike> = {}): AxeViolationLike {
  return {
    id: "button-name",
    impact: "critical",
    help: "Buttons must have discernible text",
    description: "Ensures buttons have discernible text",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.10/button-name",
    tags: ["wcag2a", "wcag412", "cat.name-role-value", "best-practice", "experimental"],
    nodes: [
      {
        html: "<button></button>",
        target: ["#icon-button"],
        failureSummary: "Fix any of the following: element has no text",
      },
    ],
    ...overrides,
  };
}

describe("normalizeAxeViolations", () => {
  it("copies ruleId from violation.id", () => {
    const [finding] = normalizeAxeViolations([violation({ id: "image-alt" })], baseContext);
    expect(finding?.ruleId).toBe("image-alt");
  });

  it("copies helpUrl", () => {
    const [finding] = normalizeAxeViolations([violation()], baseContext);
    expect(finding?.helpUrl).toBe("https://dequeuniversity.com/rules/axe/4.10/button-name");
  });

  it("maps axe serious to canonical high and preserves sourceImpact", () => {
    const [finding] = normalizeAxeViolations([violation({ impact: "serious" })], baseContext);
    expect(finding?.severity).toBe("high");
    expect(finding?.sourceImpact).toBe("serious");
  });

  it("does not change fingerprint when axe serious maps to canonical high", () => {
    const [beforeMigration] = normalizeAxeViolations(
      [violation({ impact: "serious", id: "color-contrast" })],
      baseContext,
    );
    const fingerprint = beforeMigration?.fingerprint;
    expect(fingerprint).toBe(
      createFindingFingerprint({
        ruleId: "color-contrast",
        projectName: baseContext.projectName,
        route: baseContext.route,
        profile: baseContext.profile,
        viewport: baseContext.viewport,
        target: ["#icon-button"],
      }),
    );
    expect(fingerprint).not.toContain("high");
    expect(fingerprint).not.toContain("serious");
  });

  it("copies projectName, route, profile, viewport from context", () => {
    const [finding] = normalizeAxeViolations([violation()], baseContext);
    expect(finding?.projectName).toBe("website");
    expect(finding?.route).toBe("/");
    expect(finding?.profile).toBe("default");
    expect(finding?.viewport).toBe("desktop");
  });

  it("sets source to axe and confidence/automation defaults", () => {
    const [finding] = normalizeAxeViolations([violation()], baseContext);
    expect(finding?.source).toBe("axe");
    expect(finding?.confidence).toBe("high");
    expect(finding?.automation).toBe("automated");
  });

  it("filters standards tags to wcag, best-practice, and cat.*", () => {
    const [finding] = normalizeAxeViolations([violation()], baseContext);
    expect(finding?.standards).toEqual([
      "wcag2a",
      "wcag412",
      "cat.name-role-value",
      "best-practice",
    ]);
  });

  it("produces one finding per node", () => {
    const multiNode = violation({
      nodes: [
        { html: "<button></button>", target: ["#a"] },
        { html: "<button></button>", target: ["#b"] },
      ],
    });
    const findings = normalizeAxeViolations([multiNode], baseContext);
    expect(findings).toHaveLength(2);
    expect(findings[0]?.target).toEqual(["#a"]);
    expect(findings[1]?.target).toEqual(["#b"]);
  });

  it("annotates description when axe impact is missing", () => {
    const [finding] = normalizeAxeViolations([violation({ impact: undefined })], baseContext);
    expect(finding?.severity).toBe("medium");
    expect(finding?.sourceImpact).toBeNull();
    expect(finding?.description).toContain('severity defaulted to "MEDIUM"');
  });
});

describe("createFindingId", () => {
  it("is stable for the same inputs", () => {
    const parts = {
      ruleId: "button-name",
      projectName: "website",
      route: "/",
      profile: "default",
      viewport: "desktop",
      target: "#submit",
    };
    expect(createFindingId(parts)).toBe(createFindingId(parts));
  });
});

describe("sanitizeHtmlSnippet", () => {
  it("redacts textarea contents", () => {
    expect(sanitizeHtmlSnippet('<textarea name="x">secret</textarea>')).toContain("[REDACTED]");
  });
});

describe("sortFindings", () => {
  it("orders by severity with critical first", () => {
    const findings: Finding[] = [
      {
        id: "a",
        fingerprint: "a",
        source: "axe",
        ruleId: "a",
        title: "A",
        severity: "minor",
        projectName: "p",
        profile: "default",
        target: [],
        standards: [],
      },
      {
        id: "b",
        fingerprint: "b",
        source: "axe",
        ruleId: "b",
        title: "B",
        severity: "critical",
        projectName: "p",
        profile: "default",
        target: [],
        standards: [],
      },
    ];
    expect(sortFindings(findings).map((f) => f.severity)).toEqual(["critical", "minor"]);
  });
});
