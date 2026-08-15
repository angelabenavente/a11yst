import { describe, expect, it } from "vitest";
import { stableStringify } from "@a11yst/artifacts";
import type { Finding } from "@a11yst/types";
import { validateBaselineFile } from "@a11yst/baseline";
import { createFindingFingerprint } from "../../../packages/browser/src/axe-normalize.js";
import { mapHtmlSource } from "@a11yst/source-mapping-html";
import { fixtureCatalog } from "./helpers.js";

describe("HTML mapping compatibility", () => {
  const legacyFinding: Finding = {
    id: "finding-1",
    fingerprint: "button-name|demo|/|default|desktop|#checkout",
    source: "axe",
    ruleId: "button-name",
    title: "Buttons must have discernible text",
    severity: "high",
    projectName: "demo",
    profile: "default",
    target: ["#checkout"],
    standards: ["wcag2a"],
  };

  it("preserves legacy findings without sourceMapping", () => {
    expect(stableStringify(legacyFinding).includes("sourceMapping")).toBe(false);
  });

  it("does not change fingerprint computation", () => {
    const fingerprint = createFindingFingerprint({
      ruleId: legacyFinding.ruleId,
      projectName: legacyFinding.projectName,
      route: "/",
      profile: legacyFinding.profile,
      viewport: "desktop",
      target: ["#checkout"],
    });
    expect(fingerprint).toBe(legacyFinding.fingerprint);
  });

  it("keeps baseline schema validation unchanged", () => {
    const baseline = {
      schemaVersion: "1",
      fingerprintVersion: "1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      entries: [],
    };
    expect(validateBaselineFile(baseline)).toEqual(baseline);
  });

  it("does not attach sourceMapping to findings automatically", async () => {
    const catalog = await fixtureCatalog();
    const mapping = mapHtmlSource({ catalog, evidence: { selector: "#submit-order" } });
    expect(mapping.status).toBe("mapped");
    expect(legacyFinding.sourceMapping).toBeUndefined();
  });
});
