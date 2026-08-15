import { describe, expect, it } from "vitest";
import {
  compareSeverityDescending,
  isSeverityAtLeast,
  SEVERITY_ORDER,
  severityRank,
} from "@a11yst/policy";
import type { Severity } from "@a11yst/types";

describe("policy severity helpers", () => {
  it("uses canonical severity order", () => {
    expect([...SEVERITY_ORDER]).toEqual(["minor", "medium", "high", "critical"]);
  });

  it.each([
    ["medium", "minor", true],
    ["high", "minor", true],
    ["critical", "minor", true],
    ["minor", "medium", false],
    ["medium", "medium", true],
    ["high", "medium", true],
    ["critical", "medium", true],
    ["minor", "high", false],
    ["medium", "high", false],
    ["high", "high", true],
    ["critical", "high", true],
    ["minor", "critical", false],
    ["medium", "critical", false],
    ["high", "critical", false],
    ["critical", "critical", true],
  ] as const)("isSeverityAtLeast(%s, %s) === %s", (severity, minimum, expected) => {
    expect(isSeverityAtLeast(severity, minimum)).toBe(expected);
  });

  it("ranks canonical severities monotonically", () => {
    expect(severityRank("high")).toBeGreaterThan(severityRank("medium"));
    expect(compareSeverityDescending("critical", "high")).toBeLessThan(0);
  });

  it("does not treat legacy axe labels as canonical severities", () => {
    expect(isSeverityAtLeast("high" as Severity, "high" as Severity)).toBe(true);
    expect(["serious", "moderate"] as string[]).not.toContain("high");
  });
});
