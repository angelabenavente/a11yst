# @a11yst/policy [![NPM version](https://img.shields.io/npm/v/@a11yst/policy.svg?style=flat)](https://www.npmjs.com/package/@a11yst/policy) [![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE) [![NPM total downloads](https://img.shields.io/npm/dt/@a11yst/policy.svg?style=flat)](https://www.npmjs.com/package/@a11yst/policy)

Pure CI policy evaluation for a11yst audit results.

This package decides whether audit findings **would fail a CI policy gate**.
It does not run audits, read files, or set `process.exitCode`. `@a11yst/core`
calls `evaluateCiPolicy` after an audit; `@a11yst/cli` maps that result through
`getAuditExitCode`.

## What it evaluates

- **New findings** when `failOnNew` is enabled.
- **Regressions** when `failOnRegression` is enabled.
- **Expired classifications** when `failOnExpiredClassification` is enabled.
- **Severity threshold** via `minimumSeverity` (`minor` → `critical` ordering).

Inputs are structured in-memory objects (`Finding[]`, `baselineUsed`, policy
config). The evaluator never reads `results.json`, baseline files, or
environment variables.

## Defaults (backwards compatible)

When `ci` is omitted from a11yst config, all gates are **off**:

```ts
{
  failOnNew: false,
  failOnRegression: false,
  failOnExpiredClassification: false,
  minimumSeverity: "high",
}
```

With defaults, **no findings block** and `policyEnabled` is `false`.

## Dispositions

These dispositions are **excluded** from policy breaches:

- `false-positive`
- `not-applicable`

These are **not** auto-excluded and may breach when new/regressed:

- `accepted-risk`
- `third-party`
- `manual-review`

## Baseline requirement

When any CI flag is enabled, evaluation requires `baselineUsed: true`.
Otherwise the result is `not-evaluated` — findings are **not** treated as new.

`resolved` and `not-compared` baseline entries never produce breaches.

## Policy breach vs operational error

Operational failures (invalid config, browser launch errors, corrupt baseline
files) belong to the audit/CLI layer. This evaluator may receive audit
diagnostics but does **not** convert them into policy breaches.

## Expiration vs regression

When a finding regresses solely because a classification expired and both
`failOnRegression` and `failOnExpiredClassification` are enabled, the
evaluator emits a **single** `expired-classification` breach (not two).

## Exit codes

`getAuditExitCode` maps audit completion and policy evaluation for the CLI:

| Code | Meaning |
| --- | --- |
| `0` | Audit completed; policy disabled or passed |
| `1` | Operational/config error, audit incomplete, or policy not evaluated |
| `2` | Audit completed; configured CI policy failed |

The package returns the code. It does not exit the process.

## Public API

- `evaluateCiPolicy(input)` — main evaluator
- `isSeverityAtLeast(severity, minimum)`
- `isPolicyEnabled(policy)`
- `isPolicyExcludedDisposition(disposition)`
- `dedupeFindings(findings)`
- `mergeDuplicateFinding(existing, incoming)`
- `resolveCiPolicyConfig({ configPolicy, cliOverrides })`
- `isValidMinimumSeverity(value)`
- `getAuditExitCode(input)`
- `SEVERITY_ORDER`, `severityRank`, `compareSeverityDescending`
