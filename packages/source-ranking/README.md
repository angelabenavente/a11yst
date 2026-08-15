# @a11yst/source-ranking

Deterministic, explainable ranking for static source-mapping candidates.

## Purpose

Framework mappers (HTML, React, Next.js, Vue, Nuxt, Angular) produce conservative
`SourceMappingCandidate[]` values. When multiple locations remain plausible, 10a
returns `ambiguous` without selecting a winner.

`@a11yst/source-ranking` adds a pure ranking layer that can resolve ambiguity only
when one location has clearly stronger, independent, consistent evidence.

## Matching vs ranking

- **Matching** (10b–10g): discovers candidates from static indexes and evidence.
- **Ranking** (10h): scores and compares already-built candidates.

Mappers do **not** call ranking automatically. Audit and report integration arrives
in later phases.

## Material location grouping

Candidates at the same normalized URI and region (start/end line/column) are grouped
into one `RankedSourceLocation`, regardless of provenance. Multiple provenances at
the same location are treated as corroboration.

## Scoring

Integer scores are deterministic and centralized:

- Base confidence: exact 1000, high 300, medium 180, low 80
- Positive/negative signal weights for selector, component, accessible name, etc.
- Limited bonuses for independent signal kinds and provenance diversity
- Small, controlled context adjustments (framework, adapter, scope, route, component, tag, preferred URI)

Ranking never increases confidence. Effective confidence may degrade when conflicts
or insufficient evidence are detected.

## Resolution rules

Heuristic resolution requires:

- No conflicting exact locations
- Top score ≥ `minimumResolutionScore` (default 340)
- Winning margin ≥ `minimumWinningMargin` (default 60)
- Sufficient independent evidence (not tag/route/framework/scope/preferred URI alone)
- Medium/low-specific rules documented in code

A single exact location resolves immediately. Two distinct exact locations remain
ambiguous regardless of score.

## Status

- `resolved`: clear winner
- `ambiguous`: credible tie or insufficient margin
- `insufficient`: evidence too weak (including lone low-confidence candidates)
- `invalid`: unsafe input or options

## Explainability

Each ranked location includes stable `contributions` describing score components.
Messages are generic and never include source code, secrets, or full selector/text values.

## Security

No filesystem, browser, or network access. Context strings and preferred URIs are
sanitized. Signal values reuse `@a11yst/source-mapping` redaction rules.

## Limits

Defaults: 500 candidates, 64 signals per candidate. Limits are conservative; reaching
a limit prevents silent resolution.

## Determinism

Same inputs in any order produce identical scores, ordering, diagnostics, and stable
serialization. No machine learning, probabilities, path-length heuristics, Git history,
or file popularity.

## Future work

- 10i: remediation recommendations
- 10j: pipeline integration for mapping + ranking in outputs
