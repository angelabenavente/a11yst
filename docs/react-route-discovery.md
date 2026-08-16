# React route discovery

React projects use the `@a11yst/adapters` React adapter with **static** React Router analysis. a11yst does not execute your application or evaluate modules at runtime.

## Supported patterns

| Pattern | Example | Provenance |
| --- | --- | --- |
| JSX `<Route>` | `<Route path="/about" />` | `react-jsx-route` |
| Nested JSX routes | Parent `/projects` + child `featured` → `/projects/featured` | `react-jsx-route` |
| Index routes | `<Route index />` under `/projects` → `/projects` | `react-jsx-route` |
| `createBrowserRouter([...])` | Route objects with `path` / `children` | `react-router-object` |
| `createHashRouter([...])` | Same object form as browser router | `react-router-object` |
| `useRoutes([...])` | Inline or `const`-bound route arrays | `react-router-object` |
| Local path constants | `const ROOT = "/projects"; path={ROOT}` | Resolved when the value is a static string in the same file |

Router detection requires **evidence** from `package.json` (`react-router` / `react-router-dom`) and/or source imports and factory calls. React framework detection alone is not enough.

## Dynamic routes

Dynamic segments such as `/projects/:slug` are recorded as **skipped patterns** with reason `requires configured value`. a11yst does not invent slug or id values.

Provide concrete sample paths in config when you want them audited:

```ts
routeDiscovery: {
  mode: "merge",
  samples: {
    "/projects/:slug": ["/projects/demo"],
  },
},
```

## Explicit routes and fallback

- **Explicit routes** in `a11yst.config.ts` always take precedence. Duplicate paths are deduplicated.
- **`routeDiscovery.mode: "fallback"`** keeps explicit routes when configured; discovery runs only when `routes` is empty.
- **`/` fallback** is used only when no React Router evidence exists or no auditable static/discovered routes are found.

## Inspecting discovery

```bash
pnpm a11yst routes --cwd <project>
pnpm a11yst routes --explain --cwd <project>
```

`--explain` prints discovery strategy, router evidence, discovered routes with source locations, unresolved dynamic patterns, explicit routes, and whether fallback was used.

## Limitations

- No general-purpose crawler or link extraction (`href`, `Link to`, API strings, assets).
- No runtime route generation, lazy module evaluation, or spread route configs.
- Non-static `path` expressions are reported as unresolved, not guessed.
- Not every React routing library is supported—only common React Router v6 static forms.

For apps using custom routers or heavy runtime composition, configure routes explicitly in `a11yst.config.ts`.
