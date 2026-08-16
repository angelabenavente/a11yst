# Open-source components

a11yst is distributed under the [Mozilla Public License 2.0](../LICENSE). Individual contributions remain subject to that license and to [NOTICE.md](../NOTICE.md).

Human-facing audit reports present **a11yst results**. Under the hood, a11yst may use one or more open-source engines, browser APIs, heuristics, and analysis layers. Provider names belong in technical metadata, legal notices, and optional verbose output — not in default CLI, HTML, or Markdown summaries.

## Runtime dependencies (selected)

| Component | Role in a11yst | Distribution today |
| --- | --- | --- |
| [Playwright](https://playwright.dev/) | Browser automation for web audits | npm dependency (`playwright`, `playwright-core`) |
| [axe-core](https://github.com/dequelabs/axe-core) (via `@axe-core/playwright`) | Browser accessibility rule evaluation for automated checks | npm dependency; installed with its package LICENSE and source metadata |
| Other `@a11yst/*` workspace packages | Orchestration, profiles, reporting, baselines, source analysis | MPL-2.0 packages in the publishable closure |

axe-core is **not** modified, copied, or minified into a11yst source. It is consumed as a separate npm package. Recipients who install `@a11yst/cli` receive axe-core through the normal npm dependency tree, including axe-core's own license files in `node_modules`.

## Presentation vs license notices

| Concern | Where it lives |
| --- | --- |
| User-facing severity, findings, coverage | a11yst-first CLI, HTML, Markdown |
| Raw provider impact (`sourceImpact`), engine source | JSON findings, optional `--verbose` provenance |
| Project and third-party licenses | [LICENSE](../LICENSE), [NOTICE.md](../NOTICE.md), dependency packages |

Do not remove or alter third-party license files to improve report aesthetics. Human report presentation and source/distribution license obligations are separate concerns.

## Trademarks

Third-party names (for example axe-core, Playwright, Deque) refer to their respective projects. a11yst does not claim ownership of those marks and does not present them as a11yst branding. See [TRADEMARKS.md](../TRADEMARKS.md).
