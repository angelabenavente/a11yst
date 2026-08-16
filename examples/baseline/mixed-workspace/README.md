# baseline/mixed-workspace

Monorepo-style baseline fixture with a runnable web app under `apps/web`.
The seeded baseline captures findings for the web project only.

## Projects

| Project | Platform | Baseline |
| --- | --- | --- |
| `baseline-mixed-web` | web (HTML) | Seeded in `.a11yst/baseline.json` |

## Run web app

```bash
pnpm --filter @a11yst/example-baseline-mixed-web start
```

Serves on `http://127.0.0.1:6405` (override with `PORT`).

## a11yst config

- Web project with 1 route, 1 profile, 1 desktop viewport
- Baseline comparison enabled at workspace root

Expected planned runs: web `1 × 1 × 1 = 1`.
