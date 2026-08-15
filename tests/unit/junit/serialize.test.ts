import { describe, expect, it } from "vitest";
import {
  generateJunit,
  JunitGenerationError,
  serializeJunit,
  validateGeneratedDocument,
} from "@a11yst/junit";
import { baseInput, completedRouteRun, failedRouteRun } from "./fixtures.js";
import { validateJunitXml } from "./xml-helper.js";

describe("serializeJunit", () => {
  it("serializes with two-space indent and trailing newline", () => {
    const xml = serializeJunit(
      generateJunit(baseInput({ runs: [completedRouteRun()] })).document,
    );
    expect(xml.endsWith("\n")).toBe(true);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<testsuites')).toBe(true);
    expect(xml).toContain("\n  <testsuite ");
    expect(xml).toContain("\n    <testcase ");
  });

  it("keeps root and suite counts consistent with serialized testcases", () => {
    const document = generateJunit(
      baseInput({
        runs: [completedRouteRun(), failedRouteRun(), completedRouteRun({ route: "/about" })],
      }),
    ).document;
    const xml = serializeJunit(document);
    validateJunitXml(xml);
    expect(document.tests).toBe(3);
    expect(document.errors).toBe(1);
  });

  it("rejects invalid root counts during validation", () => {
    const document = generateJunit(baseInput()).document;
    const invalid = structuredClone(document);
    invalid.tests = 99;
    expect(() => validateGeneratedDocument(invalid)).toThrow(JunitGenerationError);
  });

  it("rejects NaN and negative numeric fields", () => {
    const document = generateJunit(baseInput()).document;
    const nanDocument = structuredClone(document);
    nanDocument.time = Number.NaN;
    expect(() => serializeJunit(nanDocument)).toThrow(JunitGenerationError);

    const negativeDocument = structuredClone(document);
    negativeDocument.failures = -1;
    expect(() => serializeJunit(negativeDocument)).toThrow(JunitGenerationError);
  });

  it("does not mutate the input document", () => {
    const document = generateJunit(baseInput({ runs: [completedRouteRun()] })).document;
    const copy = structuredClone(document);
    serializeJunit(document);
    expect(document).toEqual(copy);
  });
});

describe("validateGeneratedDocument", () => {
  it("rejects empty suite lists", () => {
    const document = generateJunit(baseInput()).document;
    const invalid = structuredClone(document);
    invalid.suites = [];
    expect(() => validateGeneratedDocument(invalid)).toThrow(/at least one suite/i);
  });

  it("rejects suite metric mismatches", () => {
    const document = generateJunit(baseInput({ runs: [completedRouteRun()] })).document;
    const invalid = structuredClone(document);
    invalid.suites[0]!.failures = 5;
    expect(() => validateGeneratedDocument(invalid)).toThrow(/metric mismatch/i);
  });

  it("rejects testcase count mismatches", () => {
    const document = generateJunit(baseInput({ runs: [completedRouteRun()] })).document;
    const invalid = structuredClone(document);
    invalid.suites[0]!.tests = 99;
    expect(() => validateGeneratedDocument(invalid)).toThrow(/tests count mismatch/i);
  });
});
