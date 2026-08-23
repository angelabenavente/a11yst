# @a11yst/cli

**Package:** `@a11yst/cli`  
**Command:** `a11yst`

a11yst is an accessibility testing and regression CLI for web applications. It runs Playwright + axe audits, optional a11yst profiles and flows, baseline comparison, source analysis, and multiple report formats.

Automated accessibility checks do not establish WCAG conformance and do not replace manual accessibility testing.

Documentation: [www.a11yst.dev/getting-started](https://www.a11yst.dev/getting-started)

## Requirements

- Node.js **>= 22.12**
- Playwright Chromium for browser-based audits (installed separately; see below)

## Installation

Install the CLI as development/CI tooling:

```bash
pnpm add -D @a11yst/cli
```

## Browser setup

a11yst uses Playwright Chromium for browser-based audits. This package depends on Playwright and exposes the `playwright` command, so the documented install works with pnpm (which does not expose transitive binaries):

```bash
pnpm exec playwright install chromium
```

Chromium is managed separately by Playwright. a11yst does **not** download Chromium automatically during package installation.

Then run audits from your project directory:

```bash
pnpm exec a11yst audit
```

The consumer environment exposes `a11yst` and `playwright` from this package. Use `pnpm exec a11yst doctor` to confirm Chromium is installed.

## What this package is

- **Consumer entry package** for the a11yst CLI (`a11yst` binary).
- Depends on the full a11yst runtime closure (multiple `@a11yst/*` packages resolved transitively when installed from a registry release).

## Limitations

- Recommendations are guidance, not patches or automatic fixes.
- Source mapping is heuristic and may be ambiguous or unmapped.
- React Native runtime audits are not supported.

## Security

Report suspected vulnerabilities through GitHub private vulnerability reporting at https://github.com/angelabenavente/a11yst/security/advisories/new. Do not disclose undisclosed security problems in public issues.

## License

License: **MPL-2.0** (Mozilla Public License 2.0)

See the LICENSE file included with this package.
