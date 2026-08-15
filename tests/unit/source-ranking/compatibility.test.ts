import { describe, expect, it } from "vitest";
import { createSourceMappingResult } from "@a11yst/source-mapping";
import { candidate, signal } from "./fixtures.js";

describe("source ranking compatibility", () => {
  it("preserves createSourceMappingResult ambiguous behavior", () => {
    const result = createSourceMappingResult([
      candidate({ uri: "apps/a.tsx", line: 1, confidence: "high", provenance: "selector-match", signals: [signal("selector", true, "button#a")] }),
      candidate({ uri: "apps/b.tsx", line: 1, confidence: "high", provenance: "selector-match", signals: [signal("selector", true, "button#b")] }),
    ]);
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
  });
});
