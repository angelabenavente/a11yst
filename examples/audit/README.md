# Audit examples

Small, real, locally-servable apps used to exercise a11yst's Phase 4 browser
audits, evidence bundles, and static reports. Each example is a complete,
runnable app—nothing is generated on the fly or depends on an external service
or CDN.

> This directory itself has **no `package.json`**, so it is not a pnpm
> workspace package. Each subfolder below it is its own workspace package
> (see `pnpm-workspace.yaml`, which includes `examples/audit/*`).

## Examples

| Example                                          | Port   | Stack                  | Purpose                                        |
| ------------------------------------------------- | ------ | ----------------------- | ----------------------------------------------- |
| [`html-accessible`](./html-accessible)             | `4177` | Static HTML, `node:http` | Control case — no intentional violations       |
| [`html-inaccessible`](./html-inaccessible)         | `4178` | Static HTML, `node:http` | 3 documented violations (`button-name`, `image-alt`, `label`) |
| [`react-inaccessible`](./react-inaccessible)       | `5177` | React + Vite            | SPA with a broken route + an unimplemented `keyboard` profile |

## Requirements

- Node.js `>= 20` (see `.nvmrc`)
- pnpm `9.x`
- A Chromium build for Playwright (`pnpm exec playwright install chromium`,
  run once from the repo root after `pnpm install`)

## Run an example

Each example runs standalone with plain `node` (HTML examples) or `vite`
(React example) — no a11yst-specific tooling is required just to view the
page in a browser:

```bash
# HTML examples
pnpm --filter @a11yst/example-audit-html-accessible start
pnpm --filter @a11yst/example-audit-html-inaccessible start

# React example
pnpm --filter @a11yst/example-audit-react-inaccessible dev
```

## Run an audit

From the repo root, after `pnpm build`:

```bash
pnpm a11yst audit --cwd examples/audit/html-accessible
pnpm a11yst audit --cwd examples/audit/html-inaccessible
pnpm a11yst audit --cwd examples/audit/react-inaccessible
```

Each example's `a11yst.config.ts` declares a `devServer` (`command` + `url`,
`reuseExisting: true`), so the audit engine can start the server itself, or
reuse one you already started manually on the matching port.

Each command writes `.a11yst/results`, including `latest.json`, versioned JSON
results, and screenshot evidence. The output may contain visible or sensitive
page data: keep `.a11yst/` private and add it to your own `.gitignore` when
appropriate. a11yst does not upload output or modify `.gitignore`.

## Ports

Fixed ports are used so the example configs are simple to read, but every
`serve.mjs` / `vite.config.ts` honours `PORT` (HTML examples) or an explicit
`--port` flag (React example) if a test harness needs to override them to
avoid collisions when running examples concurrently.

## Why no nested `examples/audit/package.json`

`pnpm-workspace.yaml` includes `examples/*`, so a `package.json` directly in
`examples/audit/` would itself become a workspace package. Keeping this
folder package-free and instead listing `examples/audit/*` as a workspace
glob means only the three real, runnable apps below it are installed —
nothing needs to depend on React or Vite unless it actually uses them.
