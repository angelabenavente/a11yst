import { describe, expect, it } from "vitest";
import {
  createSourceMappingResult,
  serializeSourceMappingResult,
  stableSerializeSourceMappingResult,
} from "@a11yst/source-mapping";
import { buildReactComponentCandidate } from "./fixtures.js";

describe("source mapping serialization", () => {
  it("serializes to valid json without undefined", () => {
    const result = createSourceMappingResult([buildReactComponentCandidate()]);
    const serialized = serializeSourceMappingResult(result);
    const json = JSON.stringify(serialized);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(json.includes("undefined")).toBe(false);
  });

  it("omits undefined fields deeply", () => {
    const result = createSourceMappingResult([buildReactComponentCandidate()]);
    const json = stableSerializeSourceMappingResult(result);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(JSON.stringify(parsed)).not.toContain("undefined");
  });

  it("preserves unicode", () => {
    const candidate = buildReactComponentCandidate({
      location: {
        uri: "src/café/ボタン.tsx",
        region: { start: { line: 1 } },
      },
    });
    const json = stableSerializeSourceMappingResult(createSourceMappingResult([candidate]));
    expect(json).toContain("café");
    expect(json).toContain("ボタン");
  });

  it("does not include absolute paths or secrets in serialized output", () => {
    const result = createSourceMappingResult([
      buildReactComponentCandidate({
        signals: [{ kind: "visible-text", matched: true, value: "safe text" }],
      }),
    ]);
    const json = stableSerializeSourceMappingResult(result);
    expect(json.includes("/Users/")).toBe(false);
    expect(json.includes("password=")).toBe(false);
  });

  it("maintains stable key order through repeated serialization", () => {
    const first = stableSerializeSourceMappingResult(
      createSourceMappingResult([buildReactComponentCandidate()]),
    );
    const second = stableSerializeSourceMappingResult(
      createSourceMappingResult([buildReactComponentCandidate()]),
    );
    expect(first).toBe(second);
  });
});
