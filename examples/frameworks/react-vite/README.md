# react-vite

React 18 + Vite SPA with react-router-dom. Routes are listed explicitly in `a11yst.config.ts` for this example; the React adapter can also discover static React Router paths from source (see [React route discovery](../../../docs/react-route-discovery.md)).

## Expected routes

| Path | Finding |
| --- | --- |
| `/` | None |
| `/issues` | `button-name` (empty `<button>`) |

## Commands

```bash
pnpm dev
PORT=5500 pnpm dev
```
