import { XMLParser } from "fast-xml-parser";

function containsIllegalXmlCharacters(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd) {
      continue;
    }
    if (codePoint < 0x20) {
      return true;
    }
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      return true;
    }
    if (codePoint === 0xfffe || codePoint === 0xffff) {
      return true;
    }
  }
  return false;
}

type ParsedNode = Record<string, unknown>;

function asRecord(value: unknown): ParsedNode | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as ParsedNode;
  }
  return undefined;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseNumericAttribute(value: unknown, label: string): number {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${label} must be a numeric attribute.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative finite number.`);
  }
  return parsed;
}

function assertNoIllegalXmlChars(xml: string): void {
  if (containsIllegalXmlCharacters(xml)) {
    throw new Error("XML contains illegal XML 1.0 characters.");
  }
}

function validateTestCase(testcase: ParsedNode, suiteName: string): {
  failures: number;
  errors: number;
  skipped: number;
  time: number;
} {
  if (typeof testcase["@_name"] !== "string" || testcase["@_name"].trim() === "") {
    throw new Error(`Testcase in suite "${suiteName}" is missing a name.`);
  }
  if (typeof testcase["@_classname"] !== "string" || testcase["@_classname"].trim() === "") {
    throw new Error(`Testcase "${testcase["@_name"]}" is missing a classname.`);
  }

  let failures = 0;
  let errors = 0;
  let skipped = 0;
  let time = 0;

  if (testcase["@_time"] !== undefined) {
    time = parseNumericAttribute(testcase["@_time"], `testcase "${testcase["@_name"]}" time`);
  }
  if (testcase.failure !== undefined) failures += 1;
  if (testcase.error !== undefined) errors += 1;
  if (testcase.skipped !== undefined) skipped += 1;

  return { failures, errors, skipped, time };
}

function validateSuite(suite: ParsedNode): {
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
} {
  const suiteName = String(suite["@_name"] ?? "(unnamed)");
  const declaredTests = parseNumericAttribute(suite["@_tests"], `suite "${suiteName}" tests`);
  const declaredFailures = parseNumericAttribute(
    suite["@_failures"],
    `suite "${suiteName}" failures`,
  );
  const declaredErrors = parseNumericAttribute(suite["@_errors"], `suite "${suiteName}" errors`);
  const declaredSkipped = parseNumericAttribute(
    suite["@_skipped"],
    `suite "${suiteName}" skipped`,
  );
  const declaredTime = parseNumericAttribute(suite["@_time"], `suite "${suiteName}" time`);

  const testcases = asArray(asRecord(suite.testcase) ?? suite.testcase);
  if (declaredTests !== testcases.length) {
    throw new Error(
      `Suite "${suiteName}" declares tests=${declaredTests} but contains ${testcases.length} testcase elements.`,
    );
  }

  let failures = 0;
  let errors = 0;
  let skipped = 0;
  let time = 0;
  for (const entry of testcases) {
    const testcase = asRecord(entry);
    if (!testcase) {
      throw new Error(`Suite "${suiteName}" contains an invalid testcase node.`);
    }
    const metrics = validateTestCase(testcase, suiteName);
    failures += metrics.failures;
    errors += metrics.errors;
    skipped += metrics.skipped;
    time += metrics.time;
  }

  if (declaredFailures !== failures) {
    throw new Error(`Suite "${suiteName}" failures count mismatch.`);
  }
  if (declaredErrors !== errors) {
    throw new Error(`Suite "${suiteName}" errors count mismatch.`);
  }
  if (declaredSkipped !== skipped) {
    throw new Error(`Suite "${suiteName}" skipped count mismatch.`);
  }
  if (Number(declaredTime.toFixed(3)) !== Number(time.toFixed(3))) {
    throw new Error(`Suite "${suiteName}" time count mismatch.`);
  }

  return {
    tests: declaredTests,
    failures: declaredFailures,
    errors: declaredErrors,
    skipped: declaredSkipped,
    time: declaredTime,
  };
}

export function parseJunitXml(xml: string): ParsedNode {
  assertNoIllegalXmlChars(xml);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
    processEntities: true,
    trimValues: false,
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch (error) {
    throw new Error(
      `XML is not well-formed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const root = asRecord(parsed);
  if (!root) {
    throw new Error("XML must contain a single root element.");
  }

  const keys = Object.keys(root).filter((key) => !key.startsWith("?"));
  if (keys.length !== 1 || keys[0] !== "testsuites") {
    throw new Error(`Expected a single root <testsuites> element, found: ${keys.join(", ")}`);
  }

  return root;
}

export function validateJunitXml(xml: string): ParsedNode {
  const root = parseJunitXml(xml);
  const testsuites = asRecord(root.testsuites);
  if (!testsuites) {
    throw new Error("Missing <testsuites> root element.");
  }

  const declaredTests = parseNumericAttribute(testsuites["@_tests"], "root tests");
  const declaredFailures = parseNumericAttribute(testsuites["@_failures"], "root failures");
  const declaredErrors = parseNumericAttribute(testsuites["@_errors"], "root errors");
  const declaredSkipped = parseNumericAttribute(testsuites["@_skipped"], "root skipped");
  const declaredTime = parseNumericAttribute(testsuites["@_time"], "root time");

  const suites = asArray(asRecord(testsuites.testsuite) ?? testsuites.testsuite);
  if (suites.length === 0) {
    throw new Error("JUnit document must contain at least one <testsuite>.");
  }

  let tests = 0;
  let failures = 0;
  let errors = 0;
  let skipped = 0;
  let time = 0;
  for (const entry of suites) {
    const suite = asRecord(entry);
    if (!suite) {
      throw new Error("Invalid <testsuite> element.");
    }
    const metrics = validateSuite(suite);
    tests += metrics.tests;
    failures += metrics.failures;
    errors += metrics.errors;
    skipped += metrics.skipped;
    time += metrics.time;
  }

  if (declaredTests !== tests) {
    throw new Error("Root tests count mismatch.");
  }
  if (declaredFailures !== failures) {
    throw new Error("Root failures count mismatch.");
  }
  if (declaredErrors !== errors) {
    throw new Error("Root errors count mismatch.");
  }
  if (declaredSkipped !== skipped) {
    throw new Error("Root skipped count mismatch.");
  }
  if (Number(declaredTime.toFixed(3)) !== Number(time.toFixed(3))) {
    throw new Error("Root time count mismatch.");
  }

  return root;
}

function testsuitesNode(parsed: ParsedNode): ParsedNode {
  const testsuites = asRecord(parsed.testsuites);
  if (!testsuites) {
    throw new Error("Missing <testsuites> root element.");
  }
  return testsuites;
}

export function junitRootMetric(
  parsed: ParsedNode,
  metric: "tests" | "failures" | "errors" | "skipped" | "time",
): number {
  return parseNumericAttribute(
    testsuitesNode(parsed)[`@_${metric}`],
    `root ${metric}`,
  );
}

export function junitTestCaseNames(parsed: ParsedNode): string[] {
  const suites = asArray(asRecord(testsuitesNode(parsed).testsuite) ?? testsuitesNode(parsed).testsuite);
  return suites.flatMap((entry) => {
    const suite = asRecord(entry);
    if (!suite) return [];
    return asArray(asRecord(suite.testcase) ?? suite.testcase).flatMap((testcaseEntry) => {
      const testcase = asRecord(testcaseEntry);
      return typeof testcase?.["@_name"] === "string" ? [testcase["@_name"]] : [];
    });
  });
}

export function junitSuiteNames(parsed: ParsedNode): string[] {
  const suites = asArray(asRecord(testsuitesNode(parsed).testsuite) ?? testsuitesNode(parsed).testsuite);
  return suites.flatMap((entry) => {
    const suite = asRecord(entry);
    return typeof suite?.["@_name"] === "string" ? [suite["@_name"]] : [];
  });
}

export function junitTestCaseClassnames(parsed: ParsedNode): string[] {
  const suites = asArray(asRecord(testsuitesNode(parsed).testsuite) ?? testsuitesNode(parsed).testsuite);
  return suites.flatMap((entry) => {
    const suite = asRecord(entry);
    if (!suite) return [];
    return asArray(asRecord(suite.testcase) ?? suite.testcase).flatMap((testcaseEntry) => {
      const testcase = asRecord(testcaseEntry);
      return typeof testcase?.["@_classname"] === "string" ? [testcase["@_classname"]] : [];
    });
  });
}
