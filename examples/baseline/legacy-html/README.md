# baseline/legacy-html

Static HTML baseline fixture for Phase 8 route audits. The seeded
`.a11yst/baseline.json` exercises known, new, resolved, classified, and
partial-coverage comparison states against intentional axe violations.

## Routes

| Path | Baseline scenario |
| --- | --- |
| `/` | Known `image-alt` and false-positive `button-name` |
| `/contact` | New `label` finding (not in baseline) |
| `/fixed` | Resolved `button-name` (fixed since baseline) |
| `/review` | Known `label` with accepted-risk classification |
| `/archive` | In baseline only — excluded from config for partial coverage |

## Documented violations

| Rule | Element | Scenario |
| --- | --- | --- |
| `image-alt` | `#site-logo` | Known |
| `button-name` | `#icon-action` | False positive |
| `label` | `#email-input` on `/contact` | New |
| `button-name` | `#fixed-action` on `/fixed` | Resolved |
| `label` | `#newsletter-input` on `/review` | Accepted risk |
| `image-alt` | `#archive-logo` on `/archive` | Not compared |

## Run

```bash
pnpm --filter @a11yst/example-baseline-legacy-html start
```

Serves on `http://127.0.0.1:6401` (override with `PORT`).

## a11yst config

- 4 audited routes (archive served but not planned)
- 1 profile (`default`), 1 desktop viewport
- Baseline comparison and classifications enabled

Expected planned runs: `4 × 1 × 1 = 4`.
