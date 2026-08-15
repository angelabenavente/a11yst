import { describe, expect, it } from "vitest";
import {
  AXE_IMPACT_TO_SEVERITY,
  compareSeverity,
  compareSeverityDescending,
  DEFAULT_UNKNOWN_AXE_SEVERITY,
  formatSeverityLabel,
  isSeverityAtLeast,
  mapAxeImpactToSeverity,
  normalizeAxeImpact,
  SEVERITY_ORDER,
  severityRank,
} from "@a11yst/types";

describe("canonical severity", () => {
  it("defines exactly four ordered levels", () => {
    expect(SEVERITY_ORDER).toEqual(["minor", "medium", "high", "critical"]);
  });

  it("orders critical highest and minor lowest", () => {
    expect(compareSeverityDescending("critical", "high")).toBeLessThan(0);
    expect(compareSeverity("minor", "medium")).toBeLessThan(0);
    expect(severityRank("critical")).toBeGreaterThan(severityRank("high"));
  });

  it("formats user-facing labels in uppercase canonical spelling", () => {
    expect(formatSeverityLabel("high")).toBe("HIGH");
    expect(formatSeverityLabel("medium")).toBe("MEDIUM");
  });
});

describe("mapAxeImpactToSeverity", () => {
  it("maps axe impacts to canonical severities", () => {
    expect(mapAxeImpactToSeverity("minor")).toBe("minor");
    expect(mapAxeImpactToSeverity("moderate")).toBe("medium");
    expect(mapAxeImpactToSeverity("serious")).toBe("high");
    expect(mapAxeImpactToSeverity("critical")).toBe("critical");
  });

  it("preserves raw axe impact separately from canonical severity", () => {
    expect(normalizeAxeImpact("serious")).toBe("serious");
    expect(AXE_IMPACT_TO_SEVERITY.serious).toBe("high");
  });

  it("defaults unknown/null impact to medium", () => {
    expect(mapAxeImpactToSeverity(undefined)).toBe(DEFAULT_UNKNOWN_AXE_SEVERITY);
    expect(mapAxeImpactToSeverity(null)).toBe("medium");
    expect(mapAxeImpactToSeverity("catastrophic")).toBe("medium");
    expect(normalizeAxeImpact(undefined)).toBeNull();
  });

  it("supports policy thresholds with canonical severities", () => {
    expect(isSeverityAtLeast("high", "high")).toBe(true);
    expect(isSeverityAtLeast("medium", "high")).toBe(false);
  });
});
