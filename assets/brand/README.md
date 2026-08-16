# a11yst brand assets

Canonical visual identity masters for documentation, README, and release tooling.

Source of truth for product naming remains `@a11yst/types` (`productIdentity`). These files are visual companions only.

| Field | Value |
| --- | --- |
| Product | a11yst |
| Display | a11yst |
| CLI | a11yst |
| Tagline | Your accessibility analyst. |
| Mascot | none |

Do not use as primary identity: `A11YST`, `A11yst`, `allyst`, the legacy project spelling, mascot characters, or `Always by your side.`

This directory does not claim trademark registration. See [TRADEMARKS.md](../../TRADEMARKS.md).

## Files

| File | Purpose |
| --- | --- |
| `a11yst-symbol.svg` | Primary isotype (dark on light) |
| `a11yst-symbol-light.svg` | Isotype for dark backgrounds |
| `a11yst-symbol-monochrome.svg` | Single-color isotype |
| `a11yst-wordmark.svg` | Wordmark (dark on light) |
| `a11yst-wordmark-light.svg` | Wordmark for dark backgrounds |
| `a11yst-lockup.svg` | Symbol + wordmark |
| `a11yst-lockup-light.svg` | Lockup for dark backgrounds |
| `favicon.svg` | Favicon master (simplified symbol) |
| `tokens.json` | Design tokens (light/dark) |
| `tokens.css` | CSS custom properties generated from tokens |

## Usage

- Keep proportions and clear space (minimum: height of the symbol on all sides for lockups).
- Pick the light or dark variant for sufficient contrast.
- Use the monochrome symbol when color is unavailable.
- Do not stretch, rotate arbitrarily, or add gradients to the mark.
- Do not add registered/trademark symbols.
- Do not reintroduce mascot artwork.
- CLI remains text-only: `a11yst` plus `Your accessibility analyst.` Do not render the graphic symbol in terminal output.

Decorative logo beside visible “a11yst” text: `aria-hidden="true"` on the SVG. A logo-only home link needs an accessible name.
