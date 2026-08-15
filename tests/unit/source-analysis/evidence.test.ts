import { describe, expect, it } from "vitest";
import {
  createSourceMappingEvidenceFromFinding,
  hasExactExistingSourceLocation,
} from "@a11yst/source-analysis";
import { baseFinding, storefrontProject } from "./fixtures.js";

describe("source mapping evidence", () => {
  it("derives selector and route from finding", () => {
    const evidence = createSourceMappingEvidenceFromFinding(baseFinding(), storefrontProject);
    expect(evidence.selector).toBe("button#save");
    expect(evidence.route).toBe("/checkout");
    expect(evidence.scopeIds).toEqual(["storefront"]);
  });

  it("preserves existing source location", () => {
    const finding = baseFinding({
      sourceLocation: { uri: "src/Button.tsx", startLine: 4, startColumn: 2 },
    } as never);
    expect(hasExactExistingSourceLocation(finding)).toBe(true);
    expect(createSourceMappingEvidenceFromFinding(finding).existingSourceLocation).toEqual({
      uri: "src/Button.tsx",
      startLine: 4,
      startColumn: 2,
    });
  });

  it("does not copy raw html", () => {
    const finding = baseFinding({ html: "<button>secret</button>" });
    const evidence = createSourceMappingEvidenceFromFinding(finding);
    expect(JSON.stringify(evidence)).not.toContain("<button>");
  });
});
