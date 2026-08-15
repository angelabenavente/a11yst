# @a11yst/source-mapping

Pure domain model for mapping browser findings to repository-relative source
locations with explicit confidence, provenance, and safety invariants.

Phase **10a** defines contracts and validation only. It does **not** inspect the
filesystem, parse frameworks, resolve source maps, rank heuristics, or integrate
with reports.

## Concepts

### Source location

A canonical `SourceLocation` contains:

- `uri` — repository-relative path using `/` separators
- `region` — positive 1-based line/column positions
- optional metadata: `symbol`, `component`, `language`

Locations never include absolute paths, file URLs, HTTP URLs, snippets, or file
hashes.

### Candidate

A `SourceMappingCandidate` pairs a validated location with:

- `confidence` — `exact`, `high`, `medium`, or `low`
- `provenance` — where the candidate came from
- `signals` — short structured evidence items

Candidates never embed full findings, DOM trees, screenshots, or timestamps.

### Result

`SourceMappingResult` describes the outcome for one finding:

| Status | Meaning |
| --- | --- |
| `mapped` | Exactly one defensible candidate is selected |
| `ambiguous` | Multiple distinct candidates; no invented winner |
| `unmapped` | No usable candidate (not an operational error) |
| `invalid` | Input metadata was unsafe or structurally invalid |

## Confidence

- **exact** — direct, verifiable relationship (validated existing location, validated source map, compiler metadata)
- **high** — several independent signals converge on one location
- **medium** — reasonable but not unique match
- **low** — useful investigative hint with substantial ambiguity

Heuristic provenance (`selector-match`, `text-match`, `component-match`,
`user-provided`) cannot produce `exact` confidence.

## Provenance

Stable provenance values describe candidate origin:

| Value | Phase 10a |
| --- | --- |
| `existing-source-location` | Implemented (adapter) |
| `runtime-metadata` | Contract only |
| `source-map` | Contract only |
| `framework-compiler` | Contract only |
| `static-source-index` | Contract only |
| `selector-match` | Contract only |
| `text-match` | Contract only |
| `component-match` | Contract only |
| `user-provided` | Contract only |

Provenance does not replace confidence.

## Signals

Signals are small serializable records (`kind`, `matched`, optional `value`).
Values are length-limited, control characters stripped, and sensitive literals
redacted. Signals do not compute numeric scores and are not natural-language
explanations.

## Safety rules

Source locations are accepted only when paths are repository-relative and regions
are valid. The package rejects:

- Unix/Windows absolute paths and UNC paths
- `file://`, `http://`, and `https://` URIs
- `..` traversal escaping the repository root
- null bytes and control characters
- home-like absolute prefixes in paths and signal values

**No location is invented** when evidence is insufficient. Reports should keep
using route/flow logical locations until mapping is justified.

## Existing `sourceLocation` compatibility

`createMappingFromExistingSourceLocation()` formalizes the flat location shape
already used by SARIF and GitHub annotations:

- absent → `unmapped`
- valid relative location → `mapped` with `exact` / `existing-source-location`
- unsafe/invalid input → `invalid`

File existence is **not** checked in 10a.

## Public API (10a)

- `normalizeSourceUri`, `validateSourceRegion`, `validateSourceLocation`
- `createSourceMappingCandidate`, `createSourceMappingResult`
- `createMappingFromExistingSourceLocation`
- signal sanitization and deterministic ordering helpers
- `serializeSourceMappingResult`

## Out of scope for 10a

- Repository indexing and file search (10b)
- HTML/JSX/Vue/Angular parsing (10c–10g)
- Advanced ranking and recommendation engines (10h–10i)
- SARIF/HTML/Markdown/annotation integration (10j)

Source mapping improves traceability but **does not guarantee** that a future
recommendation will be correct.
