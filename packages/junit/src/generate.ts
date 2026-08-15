import type {
  JunitGenerationDiagnostic,
  JunitGenerationInput,
  JunitGenerationOptions,
  JunitGenerationResult,
  JunitTestCase,
  JunitTestSuite,
  JunitTestSuites,
} from "./types.js";
import { countSuiteMetrics, dedupeTestCases, sortTestCases } from "./dedupe.js";
import { sumDurationSeconds } from "./duration.js";
import {
  buildPolicyBreachTestCase,
  buildPolicyNotEvaluatedTestCase,
  buildPolicySuiteProperties,
} from "./policy.js";
import { buildDocumentProperties, buildProjectProperties, sortProperties } from "./properties.js";
import { buildRunTestCase } from "./runs.js";
import { validateGeneratedDocument } from "./serialize.js";

const DEFAULT_SUITE_PREFIX = "a11yst";

function collectProjectNames(input: JunitGenerationInput): string[] {
  const names = new Set<string>();
  for (const run of input.runs ?? []) {
    names.add(run.projectName);
  }
  for (const breach of input.policyEvaluation?.breaches ?? []) {
    names.add(breach.projectName);
  }
  if (names.size === 0) {
    names.add("default");
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function suiteDisplayName(prefix: string, projectName: string): string {
  return `${prefix} / ${projectName}`;
}

export function generateJunit(
  input: JunitGenerationInput,
  options: JunitGenerationOptions = {},
): JunitGenerationResult {
  const diagnostics: JunitGenerationDiagnostic[] = [];
  const includePassing = options.includePassingRunCases ?? true;
  const includeSkipped = options.includeSkippedRunCases ?? true;
  const suitePrefix = options.suiteName ?? DEFAULT_SUITE_PREFIX;
  const projectNames = collectProjectNames(input);
  const policyNotEvaluatedAdded = { value: false };

  const suites: JunitTestSuite[] = projectNames.map((projectName) => {
    const suiteName = suiteDisplayName(suitePrefix, projectName);
    const testcases: JunitTestCase[] = [];

    if (
      input.policyEvaluation?.status === "not-evaluated" &&
      !policyNotEvaluatedAdded.value
    ) {
      const policyError = buildPolicyNotEvaluatedTestCase(
        input.policyEvaluation,
        projectName,
        diagnostics,
      );
      if (policyError) {
        testcases.push(policyError);
        policyNotEvaluatedAdded.value = true;
      }
    }

    for (const breach of input.policyEvaluation?.breaches ?? []) {
      if (breach.projectName !== projectName) continue;
      testcases.push(buildPolicyBreachTestCase(breach, diagnostics));
    }

    for (const run of input.runs ?? []) {
      if (run.projectName !== projectName) continue;
      if (run.status === "completed" && !includePassing) continue;
      if (run.status === "skipped" && !includeSkipped) continue;
      const testcase = buildRunTestCase(run, diagnostics);
      if (testcase) {
        testcases.push(testcase);
      }
    }

    const deduped = sortTestCases(dedupeTestCases(suiteName, testcases, diagnostics));
    const metrics = countSuiteMetrics(deduped);
    const properties = sortProperties([
      ...buildProjectProperties(projectName),
      ...buildPolicySuiteProperties(input.policyEvaluation, input.policyMinimumSeverity),
    ]);

    return {
      name: suiteName,
      ...metrics,
      properties,
      testcases: deduped,
    };
  });

  const documentProperties = buildDocumentProperties(input);
  const totalTime = sumDurationSeconds(suites.map((suite) => suite.time));
  const document: JunitTestSuites = {
    name: `${suitePrefix} accessibility audit`,
    tests: suites.reduce((total, suite) => total + suite.tests, 0),
    failures: suites.reduce((total, suite) => total + suite.failures, 0),
    errors: suites.reduce((total, suite) => total + suite.errors, 0),
    skipped: suites.reduce((total, suite) => total + suite.skipped, 0),
    time: totalTime,
    properties: documentProperties,
    suites,
  };

  validateGeneratedDocument(document);

  return {
    document,
    summary: {
      suites: document.suites.length,
      tests: document.tests,
      failures: document.failures,
      errors: document.errors,
      skipped: document.skipped,
      timeSeconds: document.time,
    },
    diagnostics: sortDiagnostics(diagnostics),
  };
}

function sortDiagnostics(
  diagnostics: JunitGenerationDiagnostic[],
): JunitGenerationDiagnostic[] {
  return [...diagnostics].sort((a, b) => {
    const byCode = a.code.localeCompare(b.code);
    if (byCode !== 0) return byCode;
    return a.message.localeCompare(b.message);
  });
}
