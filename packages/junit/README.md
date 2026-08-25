# @a11yst/junit [![NPM version](https://img.shields.io/npm/v/@a11yst/junit.svg?style=flat)](https://www.npmjs.com/package/@a11yst/junit) [![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE) [![NPM total downloads](https://img.shields.io/npm/dt/@a11yst/junit.svg?style=flat)](https://www.npmjs.com/package/@a11yst/junit)

Pure, deterministic JUnit XML generation for a11yst audit results.

## Subset

This package emits a conservative JUnit XML subset widely accepted by CI systems:

- XML 1.0 declaration with UTF-8 encoding
- Root `<testsuites>` with aggregate counts and time
- Nested `<testsuite>` elements (one per audited project)
- `<testcase>`, `<failure>`, `<error>`, `<skipped>`, and `<properties>`
- Optional `<system-out>` / `<system-err>` only when they add safe summaries

No proprietary namespaces or extensions are required for core semantics.

## Suite strategy

- One suite per project: `a11yst / {projectName}` (or `a11yst / default`)
- Test cases represent audit runs, flow checkpoints, policy breaches, and operational errors — not individual findings

## Failure vs error

| Situation | JUnit element |
|-----------|---------------|
| CI policy breach | `<failure type="a11ystPolicyBreach">` |
| Policy could not be evaluated | `<error type="a11ystPolicyNotEvaluated">` |
| Audit run failed operationally | `<error type="a11ystOperationalError">` |
| Audit run skipped | `<skipped>` |
| Known / resolved / not-compared finding | Properties only — not a failure |

## Paths

- Bundle artifact: `reports/a11yst.junit.xml`
- Enable with `a11yst audit --junit` or `reports.junit` in config
- Custom copy: `a11yst audit --junit-output <path>`

## Report from results

```bash
a11yst report --from ./path/to/results.json --format junit --output ./a11yst.junit.xml
```

Reads stored `policyEvaluation`, runs, and lifecycle metadata. Does not re-run audit, baseline comparison, or policy evaluation.

## Exit codes

JUnit generation does not change a11yst exit codes (`0` passed/disabled, `1` operational/not-evaluated, `2` policy failed). JUnit is written before the process exits when a valid audit result exists.

## Not included (Phase 9e)

- Markdown reporter
- GitHub / GitLab CI integrations
- Uploads and PR comments
- Source mapping
