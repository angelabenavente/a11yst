import { JunitGenerationError } from "./errors.js";
import type { JunitTestSuites } from "./types.js";
import { escapeXmlAttribute, escapeXmlText } from "./xml.js";
import type {
  JunitFailure,
  JunitError,
  JunitProperty,
  JunitSkipped,
  JunitTestCase,
  JunitTestSuite,
} from "./types.js";

function renderProperties(properties: JunitProperty[] | undefined, indent: string): string[] {
  if (!properties || properties.length === 0) {
    return [];
  }
  const lines = [`${indent}<properties>`];
  for (const property of properties) {
    lines.push(
      `${indent}  <property name="${escapeXmlAttribute(property.name)}" value="${escapeXmlAttribute(property.value)}"/>`,
    );
  }
  lines.push(`${indent}</properties>`);
  return lines;
}

function renderFailure(failure: JunitFailure, indent: string): string {
  const attrs = `type="${escapeXmlAttribute(failure.type)}" message="${escapeXmlAttribute(failure.message)}"`;
  if (!failure.content) {
    return `${indent}<failure ${attrs}/>`;
  }
  return `${indent}<failure ${attrs}>${escapeXmlText(failure.content)}</failure>`;
}

function renderError(error: JunitError, indent: string): string {
  const attrs = `type="${escapeXmlAttribute(error.type)}" message="${escapeXmlAttribute(error.message)}"`;
  if (!error.content) {
    return `${indent}<error ${attrs}/>`;
  }
  return `${indent}<error ${attrs}>${escapeXmlText(error.content)}</error>`;
}

function renderSkipped(skipped: JunitSkipped, indent: string): string {
  return `${indent}<skipped message="${escapeXmlAttribute(skipped.message)}"/>`;
}

function renderTestCase(testcase: JunitTestCase, indent: string): string[] {
  const attrs = [
    `name="${escapeXmlAttribute(testcase.name)}"`,
    `classname="${escapeXmlAttribute(testcase.classname)}"`,
    ...(testcase.time !== undefined ? [`time="${testcase.time.toFixed(3)}"`] : []),
  ].join(" ");
  const lines: string[] = [];
  const hasBody = testcase.failure || testcase.error || testcase.skipped;
  if (!hasBody) {
    lines.push(`${indent}<testcase ${attrs}/>`);
    return lines;
  }
  lines.push(`${indent}<testcase ${attrs}>`);
  if (testcase.error) lines.push(renderError(testcase.error, `${indent}  `));
  if (testcase.failure) lines.push(renderFailure(testcase.failure, `${indent}  `));
  if (testcase.skipped) lines.push(renderSkipped(testcase.skipped, `${indent}  `));
  lines.push(`${indent}</testcase>`);
  return lines;
}

function renderSuite(suite: JunitTestSuite, indent: string): string[] {
  const attrs = [
    `name="${escapeXmlAttribute(suite.name)}"`,
    `tests="${suite.tests}"`,
    `failures="${suite.failures}"`,
    `errors="${suite.errors}"`,
    `skipped="${suite.skipped}"`,
    `time="${suite.time.toFixed(3)}"`,
  ].join(" ");
  const lines = [`${indent}<testsuite ${attrs}>`];
  lines.push(...renderProperties(suite.properties, `${indent}  `));
  for (const testcase of suite.testcases) {
    lines.push(...renderTestCase(testcase, `${indent}  `));
  }
  lines.push(`${indent}</testsuite>`);
  return lines;
}

export function serializeJunit(document: JunitTestSuites): string {
  validateSerializableDocument(document);
  const attrs = [
    `name="${escapeXmlAttribute(document.name)}"`,
    `tests="${document.tests}"`,
    `failures="${document.failures}"`,
    `errors="${document.errors}"`,
    `skipped="${document.skipped}"`,
    `time="${document.time.toFixed(3)}"`,
  ].join(" ");
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', `<testsuites ${attrs}>`];
  lines.push(...renderProperties(document.properties, "  "));
  for (const suite of document.suites) {
    lines.push(...renderSuite(suite, "  "));
  }
  lines.push("</testsuites>");
  return `${lines.join("\n")}\n`;
}

function validateSerializableDocument(document: JunitTestSuites): void {
  if (!Number.isFinite(document.tests) || document.tests < 0) {
    throw new JunitGenerationError("Invalid tests count.", "INVALID_TESTS");
  }
  for (const key of ["failures", "errors", "skipped", "time"] as const) {
    const value = document[key];
    if (!Number.isFinite(value) || value < 0) {
      throw new JunitGenerationError(`Invalid ${key} count.`, "INVALID_COUNT");
    }
  }
}

export function validateGeneratedDocument(document: JunitTestSuites): void {
  if (document.suites.length === 0) {
    throw new JunitGenerationError("JUnit document must contain at least one suite.", "MISSING_SUITE");
  }
  let tests = 0;
  let failures = 0;
  let errors = 0;
  let skipped = 0;
  let time = 0;
  for (const suite of document.suites) {
    if (suite.tests !== suite.testcases.length) {
      throw new JunitGenerationError(
        `Suite "${suite.name}" tests count mismatch.`,
        "SUITE_COUNT",
      );
    }
    let suiteFailures = 0;
    let suiteErrors = 0;
    let suiteSkipped = 0;
    let suiteTime = 0;
    for (const testcase of suite.testcases) {
      if (!testcase.name.trim() || !testcase.classname.trim()) {
        throw new JunitGenerationError("JUnit testcase name and classname are required.", "EMPTY_TESTCASE");
      }
      if (testcase.failure) suiteFailures += 1;
      if (testcase.error) suiteErrors += 1;
      if (testcase.skipped) suiteSkipped += 1;
      suiteTime += testcase.time ?? 0;
    }
    if (suite.failures !== suiteFailures || suite.errors !== suiteErrors || suite.skipped !== suiteSkipped) {
      throw new JunitGenerationError(
        `Suite "${suite.name}" metric mismatch.`,
        "SUITE_METRIC",
      );
    }
    if (Number(suite.time.toFixed(3)) !== Number(suiteTime.toFixed(3))) {
      throw new JunitGenerationError(
        `Suite "${suite.name}" time mismatch.`,
        "SUITE_TIME",
      );
    }
    tests += suite.tests;
    failures += suite.failures;
    errors += suite.errors;
    skipped += suite.skipped;
    time += suite.time;
  }
  if (
    document.tests !== tests ||
    document.failures !== failures ||
    document.errors !== errors ||
    document.skipped !== skipped
  ) {
    throw new JunitGenerationError("Root testsuites metric mismatch.", "ROOT_METRIC");
  }
  if (Number(document.time.toFixed(3)) !== Number(time.toFixed(3))) {
    throw new JunitGenerationError("Root testsuites time mismatch.", "ROOT_TIME");
  }
}
