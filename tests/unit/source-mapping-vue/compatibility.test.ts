import { describe, expect, it } from "vitest";
import { createSourceMappingResult } from "@a11yst/source-mapping";

describe("Vue compatibility with shared source mapping", () => {
  it("preserves conservative ambiguous selection semantics", () => {
    const result = createSourceMappingResult(
      [
        {
          location: { uri: "a.vue", region: { start: { line: 1, column: 1 } } },
          confidence: "high",
          provenance: "selector-match",
          signals: [],
          framework: "vue",
        },
        {
          location: { uri: "b.vue", region: { start: { line: 2, column: 1 } } },
          confidence: "medium",
          provenance: "component-match",
          signals: [],
          framework: "vue",
        },
      ],
      [],
    );
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
  });
});
