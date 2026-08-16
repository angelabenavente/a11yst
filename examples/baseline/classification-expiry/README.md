# baseline/classification-expiry

Single-page static fixture with a pre-seeded `.a11yst/baseline.json` covering
every finding disposition and several expiry schedules for injectable clock
tests.

## Classifications

| Element | Disposition | Expiry |
| --- | --- | --- |
| `#fp-logo` | false-positive | none |
| `#ar-valid-btn` | accepted-risk | 2099-12-31 (valid) |
| `#ar-expired-btn` | accepted-risk | 2020-01-01 (expired) |
| `#tp-input` | third-party | reviewAt 2099-06-01 |
| `#na-input` | not-applicable | none |
| `#mr-input` | manual-review | none |

With the system clock set after 2020-01-01, `#ar-expired-btn` should surface a
`classification-expired` regression while `#ar-valid-btn` stays classified.

## Run

```bash
pnpm --filter @a11yst/example-baseline-classification-expiry start
```

Serves on `http://127.0.0.1:6404` (override with `PORT`).

## a11yst config

- 1 route, 1 profile, 1 desktop viewport
- Baseline comparison and classifications enabled

Expected planned runs: `1 × 1 × 1 = 1`.
