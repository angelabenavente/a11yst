# @a11yst/sarif [![NPM version](https://img.shields.io/npm/v/@a11yst/sarif.svg?style=flat)](https://www.npmjs.com/package/@a11yst/sarif) [![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE) [![NPM total downloads](https://img.shields.io/npm/dt/@a11yst/sarif.svg?style=flat)](https://www.npmjs.com/package/@a11yst/sarif)

Pure SARIF 2.1.0 generation for a11yst audit results.

This package converts structured a11yst findings into a SARIF log that validates
against the OASIS SARIF 2.1.0 Plus Errata 01 schema. It does not read files,
write artifacts, or integrate with the CLI (Phase 9d).

## Public API

- `generateSarif(input, options?)` — build a SARIF log, summary, and diagnostics
- `serializeSarif(log)` — deterministic JSON with 2-space indent and trailing newline
- `mapSeverityToSarifLevel(severity)` — a11yst → SARIF level mapping

## Severity mapping

| a11yst canonical | SARIF   |
|------------------|---------|
| minor            | note    |
| medium           | warning |
| high             | error   |
| critical         | error   |

Result properties include `a11yst.severity` (canonical) and `a11yst.sourceImpact`
(raw axe impact when available).

Classifications and policy breaches do **not** change result levels.

## Rules and fingerprints

- One SARIF rule descriptor per `ruleId`
- `partialFingerprints["a11ystFingerprint/v1"]` preserves a11yst fingerprints exactly
- `primaryLocationLineHash` is never fabricated

## Lifecycle

When baseline comparison is complete, all results receive `baselineState`:

- `new` → `new`
- `known` → `unchanged`
- `regressed` → `updated`

When comparison is incomplete, `baselineState` is omitted on all results.
a11yst lifecycle is always preserved in `properties.a11yst.lifecycle`.

## Classifications

Classified findings remain visible SARIF results. SARIF suppressions are not used.

## Locations

- **Physical locations** only when `finding.sourceLocation` contains a validated
  repository-relative path and line number
- **Logical locations** for routes and flow checkpoints when no source location exists
- Source mapping is not implemented in 9c

## Validation

Unit tests validate generated logs offline against a local copy of the official
OASIS schema in `tests/fixtures/sarif/`.

## Phase 9c scope

Pure SARIF generation only — no filesystem or CLI integration.

## Phase 9d integration

- `a11yst audit --sarif` writes `reports/a11yst.sarif` inside the audit bundle
- `a11yst audit --sarif-output <path>` also writes an identical copy to a custom path
- `a11yst audit --no-sarif` disables SARIF even when enabled in config
- `a11yst report --format sarif --from <results.json> --output <path>` regenerates SARIF offline
- SARIF is disabled by default in configuration
- SARIF generation does not change CI policy exit codes (0/1/2)
- SARIF is still written when policy exit code is 2
- No GitHub upload, source mapping, or CLI stdout SARIF mode yet
