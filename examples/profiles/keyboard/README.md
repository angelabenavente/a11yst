# profiles/keyboard

Static HTML fixture for a11yst's `keyboard` accessibility profile.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Logical focus order (control) |
| `/issues` | Positive tabindex, offscreen focus, and trap-like loop |

## Run

```bash
pnpm --filter @a11yst/example-profiles-keyboard start
```

Serves on `http://127.0.0.1:6211` (override with `PORT`).

## a11yst config

- 2 routes, 1 profile (`keyboard`), 1 desktop viewport
- Expected planned runs: `2 × 1 × 1 = 2`
