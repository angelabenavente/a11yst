import { describe, expect, it } from "vitest";
import { SarifGenerationError, serializeSarif } from "@a11yst/sarif";
import { baseInput } from "./fixtures.js";
import { generateSarif } from "@a11yst/sarif";

describe("serializeSarif", () => {
  it("serializes with two-space indent and trailing newline", () => {
    const json = serializeSarif(generateSarif(baseInput()).log);
    expect(json.endsWith("\n")).toBe(true);
    expect(json.startsWith("{\n  \"$schema\"")).toBe(true);
  });

  it("omits undefined properties", () => {
    const json = serializeSarif(generateSarif(baseInput()).log);
    expect(json).not.toContain("undefined");
  });

  it("rejects NaN, Infinity, BigInt, and cycles", () => {
    const log = generateSarif(baseInput()).log;
    const nanLog = structuredClone(log);
    (nanLog.runs[0] as unknown as { tool: { driver: { version: number } } }).tool.driver.version =
      Number.NaN;
    expect(() => serializeSarif(nanLog)).toThrow(SarifGenerationError);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => serializeSarif(cyclic as never)).toThrow(/circular reference/i);

    expect(() => serializeSarif({ value: BigInt(1) } as never)).toThrow(SarifGenerationError);
  });

  it("does not mutate the input log", () => {
    const log = generateSarif(baseInput()).log;
    const copy = structuredClone(log);
    serializeSarif(log);
    expect(log).toEqual(copy);
  });
});
