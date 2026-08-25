# @a11yst/recommendations [![NPM version](https://img.shields.io/npm/v/@a11yst/recommendations.svg?style=flat)](https://www.npmjs.com/package/@a11yst/recommendations) [![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE) [![NPM total downloads](https://img.shields.io/npm/dt/@a11yst/recommendations.svg?style=flat)](https://www.npmjs.com/package/@a11yst/recommendations)

Deterministic accessibility recommendation engine for a11yst findings.

## Purpose

Framework mappers and ranking identify where an issue may live. This package turns a
normalized finding plus optional source mapping/ranking into structured guidance:
actions, verification steps, and generic code examples.

It does **not** read source files, generate patches, or integrate with audit output yet.

## Recipes

Each supported axe-style rule ID maps to a deterministic recipe with stable action IDs,
verification steps, and framework-aware generic examples. Unknown rules return
`unsupported` with limited manual guidance.

## Source confidence vs applicability

- **Source confidence** (from mapping/ranking): how trustworthy the code location is.
- **Applicability** (on the recommendation): how relevant the recipe is to the finding.

An exact location does not make the recommendation infallible, and an ambiguous target
can still yield a useful rule-specific recommendation without selecting a file.

## Targets

- `source`: a single resolved location
- `ambiguous`: no selected location; alternatives may be listed
- `logical`: route/flow/checkpoint context only
- `unmapped`: no source or logical context
- `invalid`: unsafe or invalid mapping/ranking input

Ranking/mapping conflicts never silently pick a winner.

## Security

No filesystem, browser, or network access. Inputs are sanitized; secrets and absolute
paths are redacted. Help URLs must be safe `http`/`https` links and are never fetched.

## Determinism

Same inputs in any order produce identical recommendations, targets, diagnostics, and
stable serialization. No AI, probabilities, or runtime plugins.

## Future work

Phase 10j will integrate mapping, ranking, and recommendations into audit outputs.
