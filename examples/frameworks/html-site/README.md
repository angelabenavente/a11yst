# html-site

Static HTML example served by `serve.mjs`. No explicit routes in `a11yst.config.ts` — a11yst discovers HTML files.

## Expected routes

| Path | Source file | Finding |
| --- | --- | --- |
| `/` | `index.html` | None |
| `/about/` | `about/index.html` | `button-name` (empty `<button>`) |

## Commands

```bash
pnpm dev
PORT=4500 pnpm dev
```
