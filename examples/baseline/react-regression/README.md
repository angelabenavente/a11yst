# baseline/react-regression

Minimal React (Vite) fixture for Phase 8 baseline regressions. Variants are
selected at runtime via route paths or a query param so tests can exercise
known, new, resolved, and severity-increased states without editing files.

## Variants

| Route | Scenario |
| --- | --- |
| `/v/baseline` | Known `button-name` matches baseline |
| `/v/new` | Known `button-name` plus new `label` on `#bonus-input` |
| `/v/resolved` | Baseline `button-name` fixed with `aria-label` |
| `/v/severity` | Same finding as baseline but stored severity is `minor` |
| `/?variant=…` | Query-param playground for manual checks |

## Run

```bash
pnpm --filter @a11yst/example-baseline-react-regression dev
```

Serves on `http://127.0.0.1:6402` (override with `PORT`).

## a11yst config

- 5 routes (4 variant paths + query playground)
- 1 profile (`default`), 1 desktop viewport
- Seeded `.a11yst/baseline.json` with entries for each variant path

Expected planned runs: `5 × 1 × 1 = 5`.
