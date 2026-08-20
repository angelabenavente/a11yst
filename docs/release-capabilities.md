# a11yst release inventory (Phase 13a)

Internal maintainability document for phases 13b–13j. **Not** public release documentation.

> a11yst is **accessibility testing and regression tooling**. Automated checks can identify many accessibility issues but do **not** establish WCAG conformance. a11yst complements manual accessibility testing; it does not replace it.

**Identity source:** `@a11yst/types` — `productMetadata` and `productIdentity` (`packages/types/src/product.ts`).

**Last verified against:** commit at Phase 10m close (1421 tests, clean install pass).

---

## Product identity (provisional)

| Field | Value |
| --- | --- |
| Product name | a11yst |
| Display name | a11yst |
| CLI / package command | `a11yst` |
| Tagline | Your accessibility analyst. |
| Version (CLI) | 0.1.0 |

Package names (`@a11yst/*`), imports, and CLI commands are **unchanged** in 13a.

---

## Allowed and prohibited claims

### Allowed (with caveats)

| Claim | Allowed | Notes |
| --- | --- | --- |
| Find accessibility issues automatically | yes | axe-core + a11yst heuristics; not exhaustive |
| Audit routes and interactive flows | yes | Web only; declarative flows + checkpoints |
| Track accessibility regressions | yes | Baseline comparison + lifecycle labels |
| Integrate accessibility checks into CI | yes | Exit codes, SARIF, JUnit, Markdown, GitHub annotations |
| Map findings back to source code | yes | Probabilistic/heuristic; exact/high/medium/low; ambiguous valid |
| Recommend remediation approaches | yes | Deterministic recipes; no patches; manual review when unsupported |
| Detect project frameworks | yes | Static detection; heuristic |

### Conditional

| Claim | Condition |
| --- | --- |
| React Native support | **Not allowed today** — detection/planning only; runtime audits skipped |
| Svelte / Astro support | Runtime-compatible or preview only; no source mapping |
| WCAG-related standards in findings | Rule metadata may cite related criteria; **not** conformance proof |

### Prohibited

| Claim | Notes |
| --- | --- |
| Guarantee WCAG compliance | Never |
| Certify WCAG conformance | Never |
| Replace manual testing | Never |
| Find every accessibility issue | Never |
| Automatically fix accessibility issues | Never |
| WCAG certification tool | Never |

---

## CLI command inventory

Verified via `node packages/cli/dist/bin.js --help` (build required).

| Command | Purpose | Browser | Writes files | CI-suitable |
| --- | --- | --- | --- | --- |
| `detect` | Static project/framework/package-manager detection | no | no (stdout/json only) | yes |
| `init` | Create starter `a11yst.config.ts` | no | yes (config) | yes |
| `routes` | Resolve routes via adapters (no server) | no | no | yes |
| `profiles` | List profile capabilities/limitations | no | no | yes |
| `flows` | List configured flows/steps/checkpoints | no | no | yes |
| `audit` | Run accessibility audit (Playwright + axe + profiles) | **yes** | yes (results bundle) | yes |
| `doctor` | Environment readiness checks | no | no | yes |
| `report` | Regenerate reports from persisted results | **no** | yes | yes |
| `baseline create\|status\|update\|migrate` | Baseline lifecycle management | no* | yes | yes |
| `findings` | List findings from latest/explicit results | no | no | yes |
| `classify` / `unclassify` | Baseline classification CRUD | no | yes (baseline) | preview in CI (mutating) |

\*Baseline subcommands read persisted results; they do not launch Chromium unless paired with `audit`.

**No public CLI flags** for source-analysis weights, ranking thresholds, or custom recipes. Source analysis is configured only via `sourceAnalysis` in `a11yst.config.ts`.

---

## Exit codes

Source: `packages/policy/src/exit-code.ts`, CLI integration tests.

| Code | Meaning | Typical cause |
| --- | --- | --- |
| 0 | Audit completed; CI policy disabled or passed | Operational success |
| 1 | Operational/config error, incomplete audit, or policy not evaluable | Invalid config, browser failure, missing baseline for policy |
| 2 | Audit completed; CI policy failed | `--fail-on-new`, `--fail-on-regression`, etc. |

Findings alone do **not** force exit 1. Destructive baseline ops preview with exit 2 until `--yes`.

---

## Framework support matrix

Statuses: **supported** | **partial** | **preview** | **unsupported** | **not applicable**

| Framework | Detect | Runtime audit | Routes | Source mapping | Recommendations | Status |
| --- | --- | --- | --- | --- | --- | --- |
| HTML/Vanilla | supported | supported | supported (filesystem) | supported | supported | **supported** |
| React | supported | supported | partial (react-router static discovery) | supported | supported | **supported** |
| Next.js | supported | supported | supported (App/Pages static) | supported | supported | **supported** |
| Vue | supported | supported | partial (explicit routes) | supported | supported | **supported** |
| Nuxt | supported | supported | supported (pages/app) | supported | supported | **supported** |
| Angular | supported | supported | partial (explicit routes) | supported (external + inline templates) | supported | **supported** |
| Svelte / SvelteKit | preview | supported (generic-web) | partial | unsupported | partial | **preview** |
| Astro, Preact, Solid, Qwik, Ember, Lit | runtime-compatible | supported (generic-web) | partial | unsupported | partial | **partial** |
| React Native / Expo | beta detect | **skipped** (planning only) | not applicable | not applicable | not applicable | **unsupported** (runtime) |

Source mapping packages: `@a11yst/source-mapping-html`, `-react`, `-next`, `-vue`, `-nuxt`, `-angular`; orchestrated by `@a11yst/source-analysis`.

---

## Profiles

| Profile | Purpose | Automated | Heuristic | Evidence | Limitations |
| --- | --- | --- | --- | --- | --- |
| `default` | Browser accessibility checks completed | automated browser rules | — | screenshots | Not manual-test replacement |
| `keyboard` | Tab focus traversal | partial | focus cycle/traps | focus-sequence.json | No screen reader simulation |
| `large-text` | 200% text scaling layout | partial | overflow/overlap | layout-comparison.json | Approximates reflow testing |
| `reduced-motion` | prefers-reduced-motion | partial | motion comparison | motion-comparison.json | Does not capture all motion UX |

All profiles: `reactNativeStatus: "skipped-beta"` in registry.

---

## Flows model

```
flow → steps[] → checkpoint (audit at page state)
```

**Supported step actions:** `goto`, `click`, `fill`, `press`, `check`, `uncheck`, `select`, `wait-for`, `wait-for-url`, `expect-visible`, `expect-hidden`, `expect-text`, `expect-url`, `checkpoint`.

**Not supported:** custom scripts, shell commands.

**Evidence:** flow traces, checkpoint screenshots, focus sequences (profile-dependent). Secrets redacted via `sensitive: true` / `valueFromEnv`.

**Limitations:** Reproduces configured interactions only; not a general E2E framework; no screen reader simulation.

---

## Regression, baseline, governance

| Capability | Status | Notes |
| --- | --- | --- |
| Fingerprints | supported | `fingerprintVersion: "1"` |
| Baseline file | supported | schema v1 |
| Lifecycle: `new`, `known`, `regressed`, `resolved` | supported | |
| `not-compared` | supported | coverage gaps |
| Classifications | supported | dispositions: false-positive, accepted-risk, third-party, not-applicable, manual-review |
| Classification metadata | supported | `reason` (required), `owner`, `ticket`, `expiresAt`, `reviewAt`, `notes`, `createdBy` |
| Policy / CI gates | supported | fail-on-new/regression/expired; minimum severity |
| Source analysis vs baseline | isolated | Does not change fingerprints, lifecycle, policy, or exit codes |

---

## Reports and outputs

| Format | Primary use | Source mapping | Recommendations | Machine | Human | CI |
| --- | --- | --- | --- | --- | --- | --- |
| Results JSON | canonical audit record | optional fields | optional fields | yes | yes | yes |
| HTML report | review bundle | yes | yes | no | yes | optional artifact |
| SARIF | CI/security tools | logical + physical (mapped only) | metadata | yes | partial | yes |
| JUnit | test aggregators | no expansion | no | yes | no | yes |
| Markdown | PR/release notes | yes | yes | partial | yes | yes |
| GitHub annotations | workflow commands | file/line when mapped | compact | yes | no | yes (GHA) |
| Report-from-results | offline regeneration | reads stored fields only | reads stored fields only | — | — | yes |

**Report-from-results** (`a11yst report`): 0 source-index/mapper/ranking/recommendation/browser/server/audit calls.

---

## Source analysis pipeline

```
source index (once per audit)
  → framework mapper (per finding)
  → candidate ranking (optional)
  → recommendations (optional)
  → stored on findings + sourceAnalysis summary
```

| Behavior | Contract |
| --- | --- |
| Confidence levels | exact / high / medium / low — mapping never upgrades confidence |
| Ambiguity | Valid; no auto-selection of first alternative for annotations |
| Unmapped | Valid; fail-soft |
| Ranking | Deterministic; does not increase confidence |
| Recommendations | No invented content; no patches; generic examples only |
| Fail-soft | Does not block audit; does not alter fingerprints/baseline/policy/exit |

Config: `sourceAnalysis.enabled`, `.ranking`, `.recommendations` (no CLI flags).

---

## Capability matrix (summary)

| Capability | Status | Evidence |
| --- | --- | --- |
| Installable CLI (workspace) | supported | `@a11yst/cli`, `pnpm build` |
| Config load/validate | supported | `@a11yst/config`, unit tests |
| Detection / init | supported | `@a11yst/detect`, integration |
| Web audit (Playwright + axe) | supported | `@a11yst/browser`, 264 integration tests |
| Profiles (4) | supported | `@a11yst/profiles` |
| Flows + checkpoints | supported | `@a11yst/flows` |
| Baseline + classification | supported | `@a11yst/baseline` |
| CI policy + exit codes | supported | `@a11yst/policy` |
| SARIF / JUnit / Markdown / GHA | supported | packages + CLI tests |
| Source index + mapping (6 frameworks) | supported | Phase 10 packages + 23 integration tests |
| Ranking + recommendations | supported | deterministic unit + integration tests |
| Report-from-results | supported | integration tests |
| React Native runtime audit | **not implemented** | runs skipped |
| npm publish / consumer install | **validated locally (13h)** | tarball + external consumer; not registry publish |
| Public demo / mascot artwork | **not implemented** | roadmap 13e+ |

---

## System requirements

| Audience | Node | Package manager | Browser |
| --- | --- | --- | --- |
| **Contributor (this repo)** | >= 20 (.nvmrc: 20) | pnpm 9.x (packageManager: pnpm@9.15.0) | Playwright Chromium (`pnpm exec playwright install chromium`) |
| **CI / test** | >= 20 | pnpm frozen lockfile | Chromium headless |
| **End user (future)** | >= 20 (engines) | pnpm/npm at publish time | Chromium via `pnpm exec playwright install chromium` after package install |

---

## Distribution and release state (Phase 13i)

| Area | Status |
| --- | --- |
| Local packaging (27 packages) | **validated** |
| External consumer install | **validated** |
| Frozen consumer reinstall | **validated** |
| Real installed CLI audit | **validated** |
| Public registry publish | **pending** |
| Formal release docs | **present** (`docs/release.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`) |
| CLI package README in tarball | **present** (`packages/cli/README.md`) |

---

## Repository / release gates

| Item | Status |
| --- | --- |
| LICENSE | **present** (MPL-2.0) |
| SECURITY.md | **present** (contact decision still required) |
| CONTRIBUTING.md | **present** |
| CHANGELOG.md | **present** (`Unreleased` only) |
| docs/release.md | **present** |
| Root README | present; links formal docs |
| docs/ | getting-started, release, distribution, capabilities, licensing, guides |
| `@a11yst/cli` publish metadata | partial (description, bin, keywords, README, LICENSE, NOTICE, TRADEMARKS; no repository/publishConfig) |
| npm publish | not performed |

### Release blockers

| ID | Severity | Description |
| --- | --- | --- |
| `release-repository-metadata-missing` | **blocking** | No repository/homepage/bugs metadata on publishable packages |
| `publish-access-not-configured` | **blocking** | No `publishConfig.access` on scoped packages |
| `first-public-version-undecided` | **blocking** | First public release version not confirmed |
| `security-contact-decision-required` | **blocking** | No confirmed private vulnerability reporting channel |
| `demo-not-built` | nice-to-have | Phase 13e/13f (demo exists; polish ongoing) |
| `mascot-artwork-not-built` | nice-to-have | Phase 13b+ |

### Resolved blockers

| ID | Resolved in |
| --- | --- |
| `consumer-install-unverified` | Phase 13h |
| `browser-install-experience-unresolved` | Phase 13h |
| `version-strategy-provisional` | Phase 13i (`docs/release.md`) |
| `security-policy-missing` | Phase 13i (`SECURITY.md`) |
| `release-license-undecided` | MPL-2.0 license migration (root LICENSE + package metadata) |
| `package-metadata-incomplete` | partially — formal docs/README; repository still pending |

---

## Identity string inventory (selected)

| Location | Usage | Action in 13a |
| --- | --- | --- |
| `packages/types/src/product.ts` | **canonical source** | extended with `displayName`, `productIdentity` |
| `packages/cli/src/index.ts` | CLI banner via `productMetadata` | unchanged |
| `README.md` | documentation | inventoried; update in 13c |
| Test fixtures / expected CLI output | contractual | do not bulk-replace |

---

## Surfaces for downstream phases

| Phase | Uses from 13a |
| --- | --- |
| 13b CLI polish | `productIdentity`, claims table |
| 13c–13d docs | capability matrix, framework table, requirements |
| 13e–13f demo | supported frameworks list, flow examples paths |
| 13g packaging | blockers, metadata gaps, system requirements |
