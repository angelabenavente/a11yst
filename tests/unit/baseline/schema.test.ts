import { describe, expect, it } from "vitest";
import { BaselineValidationError, validateBaselineFile } from "@a11yst/baseline";
import { baselineEntry, baselineFile, FIXED_NOW } from "./fixtures.js";

describe("validateBaselineFile", () => {
  it("accepts a minimal valid baseline file", () => {
    const valid = baselineFile({
      entries: [baselineEntry()],
    });
    expect(validateBaselineFile(valid)).toEqual(valid);
  });

  it("rejects non-object input", () => {
    expect(() => validateBaselineFile(null)).toThrow(BaselineValidationError);
    expect(() => validateBaselineFile("not-json")).toThrow(/JSON object/);
  });

  it("rejects missing schemaVersion with migration hint", () => {
    const input = { ...baselineFile(), schemaVersion: undefined };
    expect(() => validateBaselineFile(input)).toThrow(/missing schemaVersion/i);
    expect(() => validateBaselineFile(input)).toThrow(/migrate/i);
  });

  it("rejects unsupported schemaVersion", () => {
    const input = { ...baselineFile(), schemaVersion: "2" };
    expect(() => validateBaselineFile(input)).toThrow(/Unsupported baseline schemaVersion "2"/);
  });

  it("rejects missing fingerprintVersion", () => {
    const input = { ...baselineFile(), fingerprintVersion: undefined };
    expect(() => validateBaselineFile(input)).toThrow(/missing fingerprintVersion/i);
  });

  it("rejects unsupported fingerprintVersion", () => {
    const input = { ...baselineFile(), fingerprintVersion: "9" };
    expect(() => validateBaselineFile(input)).toThrow(/Unsupported fingerprintVersion "9"/);
  });

  it("requires createdAt and updatedAt", () => {
    expect(() => validateBaselineFile({ ...baselineFile(), createdAt: "" })).toThrow(
      /createdAt and updatedAt/,
    );
    expect(() => validateBaselineFile({ ...baselineFile(), updatedAt: "" })).toThrow(
      /createdAt and updatedAt/,
    );
  });

  it("requires entries to be an array", () => {
    const input = { ...baselineFile(), entries: {} };
    expect(() => validateBaselineFile(input)).toThrow(/entries must be an array/i);
  });

  it("rejects duplicate fingerprints", () => {
    const entry = baselineEntry();
    const input = baselineFile({ entries: [entry, { ...entry }] });
    expect(() => validateBaselineFile(input)).toThrow(/Duplicate baseline entry/);
    expect(() => validateBaselineFile(input)).toThrow(entry.fingerprint);
  });

  it("rejects entries missing required fields", () => {
    const corrupt = { ...baselineEntry(), fingerprint: "" };
    expect(() => validateBaselineFile(baselineFile({ entries: [corrupt] }))).toThrow(
      /missing required fields/i,
    );
  });

  it("rejects entries with unsupported fingerprintVersion", () => {
    const corrupt = baselineEntry({ fingerprintVersion: "2" as "1" });
    expect(() => validateBaselineFile(baselineFile({ entries: [corrupt] }))).toThrow(
      /Unsupported entry fingerprintVersion/,
    );
  });

  it("rejects entries with invalid location kind", () => {
    const corrupt = baselineEntry({
      location: {
        kind: "url" as "route",
        route: "/",
        profile: "default",
      },
    });
    expect(() => validateBaselineFile(baselineFile({ entries: [corrupt] }))).toThrow(
      /location is invalid/i,
    );
  });

  it("accepts flow-checkpoint locations", () => {
    const entry = baselineEntry({
      fingerprint: "flow-fp",
      location: {
        kind: "flow-checkpoint",
        flowId: "checkout",
        checkpointId: "open",
        profile: "default",
        viewport: "desktop",
      },
    });
    expect(validateBaselineFile(baselineFile({ entries: [entry] })).entries).toHaveLength(1);
  });

  it("accepts multiple entries with distinct fingerprints", () => {
    const entries = [
      baselineEntry({ fingerprint: "fp-a" }),
      baselineEntry({
        fingerprint: "fp-b",
        location: {
          kind: "route",
          route: "/about",
          profile: "default",
        },
      }),
    ];
    const validated = validateBaselineFile(baselineFile({ entries }));
    expect(validated.entries).toHaveLength(2);
    expect(validated.createdAt).toBe(FIXED_NOW);
  });
});
