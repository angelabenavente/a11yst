# profiles/large-text

Static HTML fixture for a11yst's `large-text` accessibility profile (200% text scale).

## Routes

| Path | Purpose |
| --- | --- |
| `/good` | Content reflows without overflow |
| `/overflow` | Fixed-width container causes horizontal scroll |
| `/clip` | `overflow: hidden` clips enlarged text |
| `/overlap` | Fixed elements overlap when text scales |

## Run

```bash
pnpm --filter @a11yst/example-profiles-large-text start
```

Serves on `http://127.0.0.1:6212` (override with `PORT`).

## a11yst config

- 4 routes, 1 profile (`large-text`), 1 desktop viewport
- Expected planned runs: `4 × 1 × 1 = 4`
