import type { JunitTestCase } from "./types.js";
import type { JunitGenerationDiagnostic } from "./types.js";

type CasePriority = 0 | 1 | 2 | 3;

function casePriority(testcase: JunitTestCase): CasePriority {
  if (testcase.error) return 0;
  if (testcase.failure) return 1;
  if (testcase.skipped) return 2;
  return 3;
}

function failureSeverity(testcase: JunitTestCase): number {
  if (!testcase.failure) return 0;
  const message = testcase.failure.message.toLowerCase();
  if (message.includes("critical")) return 4;
  if (message.includes("high")) return 3;
  if (message.includes("medium")) return 2;
  if (message.includes("minor")) return 1;
  return 0;
}

function mergeTestCases(current: JunitTestCase, candidate: JunitTestCase): JunitTestCase {
  const currentPriority = casePriority(current);
  const candidatePriority = casePriority(candidate);
  if (candidatePriority < currentPriority) {
    return candidate;
  }
  if (candidatePriority > currentPriority) {
    return current;
  }
  if (current.failure && candidate.failure) {
    if (failureSeverity(candidate) > failureSeverity(current)) {
      return candidate;
    }
  }
  if ((candidate.time ?? 0) > (current.time ?? 0)) {
    return { ...current, time: candidate.time };
  }
  return current;
}

export function dedupeKey(suiteName: string, testcase: JunitTestCase): string {
  return `${suiteName}|${testcase.classname}|${testcase.name}|${testcase.fingerprint ?? ""}`;
}

export function dedupeTestCases(
  suiteName: string,
  testcases: JunitTestCase[],
  diagnostics: JunitGenerationDiagnostic[],
): JunitTestCase[] {
  const byKey = new Map<string, JunitTestCase>();
  for (const testcase of testcases) {
    const key = dedupeKey(suiteName, testcase);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, testcase);
      continue;
    }
    diagnostics.push({
      code: "duplicate-testcase",
      level: "warning",
      message: `Duplicate JUnit testcase "${testcase.name}" in suite "${suiteName}" was deduplicated.`,
    });
    byKey.set(key, mergeTestCases(existing, testcase));
  }
  return [...byKey.values()];
}

export function sortTestCases(testcases: JunitTestCase[]): JunitTestCase[] {
  return [...testcases].sort((a, b) => {
    const byPriority = casePriority(a) - casePriority(b);
    if (byPriority !== 0) return byPriority;
    const byClass = a.classname.localeCompare(b.classname);
    if (byClass !== 0) return byClass;
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) return byName;
    return (a.fingerprint ?? "").localeCompare(b.fingerprint ?? "");
  });
}

export function countSuiteMetrics(testcases: JunitTestCase[]): {
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
} {
  let failures = 0;
  let errors = 0;
  let skipped = 0;
  let time = 0;
  for (const testcase of testcases) {
    if (testcase.failure) failures += 1;
    if (testcase.error) errors += 1;
    if (testcase.skipped) skipped += 1;
    time += testcase.time ?? 0;
  }
  return {
    tests: testcases.length,
    failures,
    errors,
    skipped,
    time: Number(time.toFixed(3)),
  };
}
