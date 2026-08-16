# profiles/mixed-workspace

Workspace with a web HTML project that runs all four a11yst profiles.

## Projects

| Name | Platform | Executes |
| --- | --- | --- |
| `profiles-mixed-web` | web / html | Yes |

## Run web app

```bash
pnpm --filter @a11yst/example-profiles-mixed-web start
```

Serves on `http://127.0.0.1:6215` (override with `PORT`).

## a11yst config

- Web: 1 route × 4 profiles × 1 viewport = 4 planned runs
