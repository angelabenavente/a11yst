import { describe, expect, it } from "vitest";
import {
  MAX_SIGNAL_VALUE_LENGTH,
  sanitizeSignal,
  sanitizeSignals,
  sortSignals,
} from "@a11yst/source-mapping";
import { hostileSignalMetadata } from "./fixtures.js";

describe("source mapping signals", () => {
  it("accepts valid kinds and matched flags", () => {
    const result = sanitizeSignal({ kind: "selector", matched: true, value: "button.checkout" });
    expect(result.signal).toEqual({
      kind: "selector",
      matched: true,
      value: "button.checkout",
    });
    expect(result.diagnostics).toEqual([]);
  });

  it("allows absent values", () => {
    const result = sanitizeSignal({ kind: "route", matched: false });
    expect(result.signal.value).toBeUndefined();
  });

  it("truncates long values", () => {
    const long = "a".repeat(MAX_SIGNAL_VALUE_LENGTH + 10);
    const result = sanitizeSignal({ kind: "visible-text", matched: true, value: long });
    expect(result.signal.value).toHaveLength(MAX_SIGNAL_VALUE_LENGTH);
    expect(result.diagnostics.some((d) => d.code === "truncated-signal")).toBe(true);
  });

  it("strips control characters", () => {
    const result = sanitizeSignal({
      kind: "attribute",
      matched: true,
      value: "data-\u0001-test",
    });
    expect(result.signal.value).toBe("data--test");
  });

  it("redacts hostile and sensitive values", () => {
    for (const signal of hostileSignalMetadata) {
      const result = sanitizeSignal(signal);
      expect(result.signal.value).toBeUndefined();
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(
        result.diagnostics.some(
          (d) => d.code === "sensitive-value-redacted" || d.code === "truncated-signal",
        ),
      ).toBe(true);
    }
  });

  it("orders signals deterministically", () => {
    const signals = sortSignals([
      { kind: "visible-text", matched: true, value: "z" },
      { kind: "attribute", matched: false },
      { kind: "component-name", matched: true, value: "a" },
    ]);
    expect(signals.map((signal) => signal.kind)).toEqual([
      "attribute",
      "component-name",
      "visible-text",
    ]);
  });

  it("batch sanitization preserves order", () => {
    const { signals } = sanitizeSignals([
      { kind: "route", matched: true, value: "/checkout" },
      { kind: "selector", matched: true, value: "button" },
    ]);
    expect(signals.map((signal) => signal.kind)).toEqual(["route", "selector"]);
  });
});
