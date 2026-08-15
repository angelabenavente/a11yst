# flows/react-checkout

React + Vite checkout fixture for a11yst Phase 7 user flows, multi-profile audits, and axe findings.

## Features

- Product list with **Add to cart** buttons
- Cart drawer (`role="dialog"`) with line items and checkout form
- Validation errors when submitting an empty checkout form
- Success message after a valid checkout

## Intentional issues

| Kind | Issue | Expected signal |
| --- | --- | --- |
| Axe | Product thumbnail uses `alt=""` on meaningful image | `image-alt` |
| Axe | Promo toggle button has no accessible name | `button-name` |
| Flow | Cart drawer opens without moving focus inside | `dialog-focus-entry` |
| Flow | Validation errors appear without focus on an error target | `form-error-focus-review` |
| Profile | Fixed-height product description clips at 200% text scale | `large-text-*` rules |
| Profile | Spinner ignores `prefers-reduced-motion` | `reduced-motion-infinite-animation` |

## Flows

| Flow id | Checkpoints | Profiles |
| --- | --- | --- |
| `open-cart` | `cart-drawer-open` | `default`, `keyboard`, `large-text`, `reduced-motion` |
| `checkout-validation-errors` | `validation-errors` | `default`, `keyboard` |
| `successful-checkout` | `order-confirmation` | `default` |

All flow steps use **role/name** locators (for example `{ role: "button", name: "Place order" }`).

## Run

```bash
pnpm --filter @a11yst/example-flows-react-checkout start
```

Builds the app if needed, then serves the production bundle with `vite preview` on `http://127.0.0.1:6320` (override with `PORT`).

## a11yst config

- 1 route, 4 profiles, 1 desktop viewport
- 3 flows with explicit checkpoints
- Route planned runs: `1 × 4 × 1 = 4`
- Flow checkpoint runs: `(1×4 + 1×2 + 1×1) × 1 viewport = 7`

Audit flows only:

```bash
pnpm a11yst audit --cwd examples/flows/react-checkout --flows-only
```
