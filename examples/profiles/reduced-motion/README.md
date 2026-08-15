# profiles/reduced-motion

Static HTML fixture for a11yst's `reduced-motion` accessibility profile.

## Routes

| Path | Purpose |
| --- | --- |
| `/good` | Animations disabled under `prefers-reduced-motion` |
| `/bad-infinite` | Infinite spinner always running |
| `/long-transform` | Transform animation longer than 300ms |
| `/fade-control` | 100ms opacity fade (below significance threshold) |

## Run

```bash
pnpm --filter @a11yst/example-profiles-reduced-motion start
```

Serves on `http://127.0.0.1:6213` (override with `PORT`).

## a11yst config

- 4 routes, 1 profile (`reduced-motion`), 1 desktop viewport
- Expected planned runs: `4 × 1 × 1 = 4`
