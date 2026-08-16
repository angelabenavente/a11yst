# profiles/multi-profile-react

Minimal React + Vite SPA exercising all four a11yst accessibility profiles.

## Routes

| Path | Findings |
| --- | --- |
| `/` | None (control) |
| `/checkout` | `button-name`, keyboard tabindex, large-text clip, reduced-motion infinite animation |

## Commands

```bash
pnpm --filter @a11yst/example-profiles-multi-profile-react dev
PORT=5500 pnpm dev
```

## a11yst config

- 2 routes × 4 profiles × 1 viewport = 8 planned runs
