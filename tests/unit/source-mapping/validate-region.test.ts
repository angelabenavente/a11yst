import { describe, expect, it } from "vitest";
import {
  SourceMappingValidationError,
  validateSourceRegion,
  type SourceRegion,
} from "@a11yst/source-mapping";

describe("validateSourceRegion", () => {
  it("accepts line only", () => {
    expect(validateSourceRegion({ start: { line: 10 } })).toEqual({ start: { line: 10 } });
  });

  it("accepts line and column", () => {
    expect(validateSourceRegion({ start: { line: 10, column: 2 } })).toEqual({
      start: { line: 10, column: 2 },
    });
  });

  it("accepts start and end regions", () => {
    expect(
      validateSourceRegion({
        start: { line: 10, column: 2 },
        end: { line: 12, column: 4 },
      }),
    ).toEqual({
      start: { line: 10, column: 2 },
      end: { line: 12, column: 4 },
    });
  });

  it("accepts multiline end without end column", () => {
    expect(
      validateSourceRegion({
        start: { line: 10 },
        end: { line: 12 },
      }),
    ).toEqual({
      start: { line: 10 },
      end: { line: 12 },
    });
  });

  it("rejects zero and negative lines", () => {
    expect(() => validateSourceRegion({ start: { line: 0 } })).toThrow(
      SourceMappingValidationError,
    );
    expect(() => validateSourceRegion({ start: { line: -1 } })).toThrow(
      SourceMappingValidationError,
    );
  });

  it("rejects decimal lines", () => {
    expect(() => validateSourceRegion({ start: { line: 1.5 } })).toThrow(
      SourceMappingValidationError,
    );
  });

  it("rejects invalid columns", () => {
    expect(() => validateSourceRegion({ start: { line: 1, column: 0 } })).toThrow(
      SourceMappingValidationError,
    );
    expect(() => validateSourceRegion({ start: { line: 1, column: -2 } })).toThrow(
      SourceMappingValidationError,
    );
  });

  it("rejects end before start", () => {
    expect(() =>
      validateSourceRegion({ start: { line: 5 }, end: { line: 4 } }),
    ).toThrow(SourceMappingValidationError);
    expect(() =>
      validateSourceRegion({
        start: { line: 5, column: 10 },
        end: { line: 5, column: 2 },
      }),
    ).toThrow(SourceMappingValidationError);
  });

  it("rejects nan and infinity", () => {
    expect(() => validateSourceRegion({ start: { line: Number.NaN } })).toThrow(
      SourceMappingValidationError,
    );
    expect(() => validateSourceRegion({ start: { line: Number.POSITIVE_INFINITY } })).toThrow(
      SourceMappingValidationError,
    );
  });

  it("does not mutate input", () => {
    const region: SourceRegion = { start: { line: 3, column: 1 } };
    const copy = structuredClone(region);
    validateSourceRegion(region);
    expect(region).toEqual(copy);
  });
});
