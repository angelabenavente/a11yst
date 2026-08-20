# Product identity (CLI and human output)

## Canonical identity

| Field | Value |
| --- | --- |
| Product | a11yst |
| Display | a11yst |
| CLI | a11yst |
| Tagline | Your accessibility analyst. |
| Mascot | none (retired from current public identity) |

Source: `productIdentity` in `@a11yst/types` (`packages/types/src/product.ts`).

Visual assets: [`assets/brand/`](../assets/brand/) and [`assets/brand/README.md`](../assets/brand/README.md).

## Rules

- Identity strings come from `productIdentity`; do not duplicate them in CLI formatters.
- The CLI presentation layer (`packages/cli/src/presentation/`) owns terminal rendering.
- The canonical CLI header is minimal: product name plus primary tagline only.
- Machine-readable outputs (JSON, SARIF, JUnit, GitHub annotations, manifests, results) must not include terminal branding or taglines.
- Branding must not imply WCAG conformance, certification, or that manual testing is unnecessary.

## Human vs machine

| Output kind | Terminal branding |
| --- | --- |
| Human (TTY, interactive) | Identity text only |
| Human (plain / CI / piped) | Identity text only |
| Machine (JSON, etc.) | No terminal branding |
| Artifacts (reports, bundles) | No terminal branding |

## Voice

- Concise, factual, collaborative, calm, actionable.
- Avoid celebratory compliance language, guilt, infantilization, and false certainty.

Examples to avoid: “Your site is accessible!”, “Everything looks perfect!”, “You're WCAG compliant!”

Preferred patterns: “Audit completed.”, “No configured policy breach was detected.”, “Some accessibility barriers require manual testing.”

## Future web identity (P4)

Primary identity for upcoming web surfaces:

- Product: **a11yst**
- Tagline: **Your accessibility analyst.**
- Mascot: **none** — the former Ally terminal mascot is retired from the current public identity. No replacement mascot is planned for this phase.
