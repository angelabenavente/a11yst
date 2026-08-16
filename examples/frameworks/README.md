# Framework examples (Phase 5)

Minimal, hand-written example apps that exercise a11yst route discovery, dev-server metadata, and intentional axe findings across common web frameworks.

Each app includes an `a11yst.config.ts` with `routeDiscovery`, `devServer`, and a controlled `PORT` via `process.env.PORT`.

## Examples

| App | Framework | Routes | Intentional finding | Startup notes |
| --- | --- | --- | --- | --- |
| [html-site](./html-site/) | Static HTML | Discovered (`/`, `/about/`) | `button-name` on `/about/` | Fast — `node serve.mjs` |
| [react-vite](./react-vite/) | React 18 + Vite | `/`, `/issues` | `button-name` on `/issues` | Fast — Vite dev server |
| [next-app](./next-app/) | Next.js App Router | Discovered + sample | `button-name` on `/about` | **Slower** — Next dev compiles on demand |
| [angular-app](./angular-app/) | Angular 18 | `/`, `/contact` (explicit) | `button-name` on `/contact` | **Slower** — Angular CLI dev server |
| [vue-vite](./vue-vite/) | Vue 3 + Vite | `/`, `/issues` | `button-name` on `/issues` | Fast — Vite dev server |
| [nuxt-app](./nuxt-app/) | Nuxt 3 | Discovered + sample | `label` on `/about` | **Slower** — Nuxt dev server |

## Running locally

From any example directory:

```bash
pnpm install
pnpm dev
# or: PORT=4500 pnpm dev
```

Then from the repo root (after building packages):

```bash
pnpm a11yst audit --project <project-name>
```

## Route discovery notes

- **html-site** — no explicit routes; a11yst discovers `.html` files under the project root.
- **next-app** / **nuxt-app** — static pages are discovered from the filesystem; dynamic segments use `routeDiscovery.samples` (pattern keys use adapter notation, e.g. `/products/:id`).
- **angular-app** — Angular routing is not parsed; list routes explicitly in `a11yst.config.ts`.
