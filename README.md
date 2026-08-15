# a11yst

Your accessibility analyst.

a11yst is an accessibility testing and regression tool for web applications.

Before running audits, install the Chromium browser binary once per machine or CI image:

```bash
pnpm exec playwright install chromium
```

Chromium is not downloaded by `pnpm install`.
