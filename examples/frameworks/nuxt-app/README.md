# nuxt-app

Minimal Nuxt 3 example. Static pages are discovered from `pages/`; dynamic segments use `routeDiscovery.samples`.

> **Note:** Nuxt dev startup is slower than Vite or static HTML examples.

## Expected routes

| Path | Source | Finding |
| --- | --- | --- |
| `/` | `pages/index.vue` | None |
| `/about` | `pages/about.vue` | `label` (unlabeled `<input>`) |
| `/users/example` | sample for `/users/:id` | None |

## Commands

```bash
pnpm dev
PORT=3700 pnpm dev
```

## Config sample

```ts
routeDiscovery: {
  mode: "fallback",
  samples: {
    "/users/:id": ["/users/example"],
  },
},
```
