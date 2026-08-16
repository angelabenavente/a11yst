# Source analysis

After a web audit, a11yst can enrich findings with **source mapping** and **recommendations**. This runs during audit execution when `sourceAnalysis.enabled` is true (default).

```text
finding → source candidates → mapping → ranking → recommendation
```

Source analysis is fail-soft: mapping failures do not fail the audit.

## Supported frameworks

Source mapping is implemented for:

| Framework | Source mapping |
| --- | --- |
| HTML / Vanilla | yes |
| React | yes |
| Next.js | yes |
| Vue | yes |
| Nuxt | yes |
| Angular | yes (external and inline templates) |
| Svelte / SvelteKit | no |
| Astro | no |
| React Native | no |

Angular mapping analyzes static templates; a11yst does not parse Angular Router configuration for routes or source locations.

## Configuration

Public options only:

```typescript
sourceAnalysis: {
  enabled: true,
  ranking: true,
  recommendations: true,
},
```

No public ranking weights, thresholds, or scoring constants exist in configuration.

## Source mapping

Each finding may receive a **source mapping** result with:

- `status` — mapping outcome
- `confidence` — evidence strength when mapped
- `location` — repository-relative file and region when selected
- `candidates` — alternative locations when ambiguous

### Mapping status

| Status | Meaning |
| --- | --- |
| `mapped` | A location was selected with sufficient evidence |
| `ambiguous` | Multiple plausible locations; a11yst does not pick arbitrarily |
| `unmapped` | Insufficient evidence to map |
| `invalid` | Mapping cannot be considered valid (unsafe path, invalid region, etc.) |

Unmapped or ambiguous mappings are normal outcomes, not audit failures.

### Confidence levels

| Level | Meaning |
| --- | --- |
| `exact` | Strongest evidence (for example an existing source location from runtime metadata) |
| `high` | High-confidence heuristic match |
| `medium` | Moderate heuristic match |
| `low` | Weak heuristic match |

Confidence describes evidence strength. It is not a guarantee that the location is correct. Heuristic levels do not imply certainty.

## Ranking

When multiple candidates exist, a11yst **ranks** them deterministically using available signals (component names, selectors, text, framework metadata, and similar). Ranking:

- groups equivalent candidates;
- requires sufficient evidence before selecting a winner;
- preserves **ambiguous** status when no clear winner exists;
- does **not** increase confidence beyond what evidence supports.

Internal weights and thresholds are not public configuration.

## Recommendations

Recommendations are deterministic guidance built from:

- finding and rule context;
- framework;
- selected source target when mapping succeeded;
- suggested actions and manual verification steps.

Recommendations are **not patches**. a11yst does not edit application source code.

Do not describe recommendations as AI fixes or automatic remediation.

## Privacy and output

a11yst is designed to avoid including source snippets and known sensitive values in source-analysis output. Reports use repository-relative locations. Source analysis does not intentionally embed secrets, but audit bundles may still contain page content in screenshots and HTML snippets—handle output accordingly.

## Manual testing

Source mapping and recommendations complement manual accessibility testing. They do not replace keyboard testing, screen-reader review, or WCAG conformance assessment.

## Next steps

- [Reports](./reports.md) — how mapping and recommendations appear in output formats
- [Configuration](./configuration.md) — enable or disable source analysis
- [Baselines & governance](./baselines-and-governance.md) — lifecycle labels alongside enriched findings
