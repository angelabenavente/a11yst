# @a11yst/source-analysis [![NPM version](https://img.shields.io/npm/v/@a11yst/source-analysis.svg?style=flat)](https://www.npmjs.com/package/@a11yst/source-analysis) [![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE) [![NPM total downloads](https://img.shields.io/npm/dt/@a11yst/source-analysis.svg?style=flat)](https://www.npmjs.com/package/@a11yst/source-analysis)

Orchestrates repository source indexing, framework mapping, candidate ranking, and
accessibility recommendations for a11yst audit findings.

## Execution model

Source analysis runs **once per audit** after findings are normalized and fingerprinted.
It builds the source index once, memoizes framework catalogs, enriches findings with
optional `sourceMapping`, `sourceRanking`, and `recommendations`, and writes a
`sourceAnalysis` summary on the audit result.

Reporters and `a11yst report --from-results` consume stored enrichment only — they do
not re-index, re-map, or regenerate recommendations.

## Configuration

```ts
sourceAnalysis?: {
  enabled?: boolean;        // default true
  ranking?: boolean;        // default true
  recommendations?: boolean; // default true
};
```

When `enabled: false`, findings are unchanged. When `ranking: false`, mapper results are
kept without ranking. When `recommendations: false`, mapping/ranking still run but
recommendations are omitted.

## Fail-soft

Source analysis enriches findings but does not change fingerprints, baseline comparison,
policy evaluation, or exit codes. Recoverable mapper/ranking/recommendation failures
produce diagnostics and preserve original finding data.

## Supported frameworks

HTML/Vanilla, React, Next.js, Vue, Nuxt, and Angular mappers are invoked based on
detected project framework. Unknown or unsupported frameworks leave findings unmapped
without incorrect fallbacks.

## Security

No source snippets, absolute repository roots, or secrets are written to results or
reports. Recommendations use generic examples only.

## Future work

Phase 10k adds real multi-framework fixtures. Phase 10l runs full integration
regression. Phase 10m closes with clean install verification.
