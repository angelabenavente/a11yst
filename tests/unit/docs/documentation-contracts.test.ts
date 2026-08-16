import { describe, expect, it } from "vitest";
import { listProfiles } from "@a11yst/profiles";
import type { FindingDisposition } from "@a11yst/types";

const DOCUMENTED_PROFILES = ["default", "keyboard", "large-text", "reduced-motion"] as const;

const DOCUMENTED_DISPOSITIONS: FindingDisposition[] = [
  "false-positive",
  "accepted-risk",
  "third-party",
  "not-applicable",
  "manual-review",
];

const DOCUMENTED_REPORT_FORMATS = ["html", "sarif", "junit", "markdown"] as const;

const DOCUMENTED_SOURCE_STATUSES = ["mapped", "ambiguous", "unmapped", "invalid"] as const;

const DOCUMENTED_CONFIDENCE = ["exact", "high", "medium", "low"] as const;

describe("documentation contracts", () => {
  it("documents the same profile IDs as the registry", () => {
    const registryIds = listProfiles().map((profile) => profile.id).sort();
    expect(registryIds).toEqual([...DOCUMENTED_PROFILES].sort());
  });

  it("documents classification dispositions from shared types", () => {
    for (const disposition of DOCUMENTED_DISPOSITIONS) {
      expect(disposition.length).toBeGreaterThan(0);
    }
    expect(DOCUMENTED_DISPOSITIONS).toHaveLength(5);
  });

  it("documents report formats supported by the report command", () => {
    expect(DOCUMENTED_REPORT_FORMATS).toContain("html");
    expect(DOCUMENTED_REPORT_FORMATS).toContain("sarif");
    expect(DOCUMENTED_REPORT_FORMATS).toHaveLength(4);
  });

  it("documents source mapping status and confidence enums", () => {
    expect(DOCUMENTED_SOURCE_STATUSES).toEqual([
      "mapped",
      "ambiguous",
      "unmapped",
      "invalid",
    ]);
    expect(DOCUMENTED_CONFIDENCE).toEqual(["exact", "high", "medium", "low"]);
  });
});
