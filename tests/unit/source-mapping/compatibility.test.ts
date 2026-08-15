import { describe, expect, it } from "vitest";
import { createFindingFingerprint } from "../../../packages/browser/src/axe-normalize.js";
import { validateBaselineFile } from "@a11yst/baseline";
import { stableStringify } from "@a11yst/artifacts";
import type { Finding } from "@a11yst/types";
import { stableSerializeSourceMappingResult, createSourceMappingResult } from "@a11yst/source-mapping";
import { buildReactComponentCandidate } from "./fixtures.js";

describe("source mapping compatibility", () => {
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
    const json = stableStringify(legacyFinding);
    expect(json.includes("sourceMapping")).toBe(false);
    expect(JSON.parse(json)).toEqual(legacyFinding);
  });

  it("allows optional sourceMapping without affecting required fields", () => {
    const withMapping: Finding = {
      ...legacyFinding,
      sourceMapping: createSourceMappingResult([buildReactComponentCandidate()]),
    };
    const parsed = JSON.parse(stableStringify(withMapping)) as Finding;
    expect(parsed.id).toBe(legacyFinding.id);
    expect(parsed.fingerprint).toBe(legacyFinding.fingerprint);
    expect(parsed.sourceMapping?.status).toBe("mapped");
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

  it("serializes sourceMapping results without undefined", () => {
    const json = stableSerializeSourceMappingResult(
      createSourceMappingResult([buildReactComponentCandidate()]),
    );
    expect(json.includes("undefined")).toBe(false);
  });
});
