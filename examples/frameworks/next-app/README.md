# next-app

Minimal Next.js App Router example. Routes are discovered from `app/`; dynamic segments use `routeDiscovery.samples`.

> **Note:** Next.js dev startup is slower than Vite or static HTML examples because it compiles routes on demand.

## Expected routes

| Path | Source | Finding |
| --- | --- | --- |
| `/` | `app/page.tsx` | None |
| `/about` | `app/about/page.tsx` | `button-name` |
| `/products/example` | sample for `/products/:id` | None |

## Commands

```bash
pnpm dev
PORT=3500 pnpm dev
```

## Config sample

```ts
routeDiscovery: {
  mode: "fallback",
  samples: {
    "/products/:id": ["/products/example"],
  },
},
```
