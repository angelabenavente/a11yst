# baseline/flow-regression

Static HTML fixture for Phase 8 flow-checkpoint baseline comparison. Combines
a11yst flow rules and axe violations at checkpoints with seeded baseline entries
for known, new, resolved, and incomplete flow coverage.

## Flows

| Flow id | Scenario |
| --- | --- |
| `panel-known` | Known `dialog-focus-entry` at `panel-open` |
| `panel-new` | Known dialog focus plus new `label` on `#bonus-field` |
| `panel-resolved` | Baseline dialog focus entry resolved by accessible panel |
| `checkout-partial` | Full checkout through `confirmation` checkpoint |
| `checkout-short` | Stops at `cart-ready` — `confirmation` baseline not compared |

## Run

```bash
pnpm --filter @a11yst/example-baseline-flow-regression start
```

Serves on `http://127.0.0.1:6403` (override with `PORT`).

Use `/partial?mode=short` as the start URL for `checkout-short`.

Audit flows only:

```bash
pnpm a11yst audit --cwd examples/baseline/flow-regression --flows-only
```

## a11yst config

- 5 routes, 2 profiles (`default`, `keyboard`), 1 desktop viewport
- 5 flows with explicit checkpoints
- Baseline comparison enabled
