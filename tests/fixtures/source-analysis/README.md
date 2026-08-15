# Source analysis integration fixtures

These directories contain **non-executable** source trees used by a11yst integration tests.
They are not applications, do not require `pnpm install`, and must never be run with
framework dev servers or build commands.

## `real-monorepo/`

Multi-framework monorepo with representative static source for:

| App | Framework | Mapped cases |
|-----|-----------|--------------|
| `legacy-html` | HTML/Vanilla | `#submit-order`, image without alt |
| `react-store` | React | `#react-submit-order`, `#shared-submit` |
| `next-store` | Next.js App Router | `/checkout` page button, page/layout ambiguity |
| `vue-admin` | Vue SFC | dialog close button, `#shared-submit` |
| `nuxt-admin` | Nuxt | `/checkout` page button, page/layout ambiguity |
| `angular-admin` | Angular | external template + inline template dialog |

### Ambiguous cases

- HTML: duplicate `.primary.action` buttons in `checkout.html`
- Next: `#next-shared-action` in checkout layout and page
- Nuxt: `#nuxt-shared-action` in default layout and checkout page

### Unmapped cases

- React/Vue/Angular dynamic prop bindings (`DynamicButton` components)
- Next loading-only button without file role hint
- Script literals in HTML (not indexed as elements)

### Ranking cases

- Ambiguous selectors with near-tie high candidates (HTML/Next/Nuxt)
- Insufficient evidence for low-only or tie scenarios after ranking

### Recommendations

- `button-name`, `image-alt`, `aria-dialog-name`, `label`, unknown rules
- Generic examples only; no product text from fixtures

### Sensitive fictitious literals

Fixtures and tests may include markers such as `A11YST_SECRET_*_10K`.
These are **test-only** markers and must not be reused in public documentation.

## `partial-monorepo/`

Contains malformed React source alongside valid HTML for fail-soft tests.
The happy-path fixture must remain complete.

## Maintaining expected line/column values

Expected locations live in `tests/integration/source-analysis/expected-locations.ts`.
When editing fixture source:

1. Change the fixture file.
2. Re-run the relevant integration test or a local mapper probe.
3. Update explicit line/column constants — do not derive expectations from mapper helpers used in assertions.

## Later phases

- **10l** runs the full integration regression suite.
- **10m** performs clean install verification and release closure.
