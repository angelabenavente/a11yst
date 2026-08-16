# Contribution governance

This document describes how a11yst governs external contributions. It is operational guidance, not a contract.

## Roles

- **Maintainer** — project maintainer with merge authority once contribution gates are active.
- **Contributor** — person submitting feedback or code.
- **Receiving Party** — legal entity or individual that will receive contributor grants once confirmed; currently **undecided**.

No individual maintainer names are listed here because project organization details are not yet finalized publicly.

## Contribution access model

| Activity | Current status |
| --- | --- |
| Issues | welcome |
| Bug reports | welcome |
| Feature proposals | welcome |
| Documentation pull requests | welcome |
| Code pull requests | welcome |
| Pull request review and discussion | welcome |
| External code merge | **blocked until active CLA** |

## External code pull request states

For external code contributions today:

| State | Status |
| --- | --- |
| **Open** (PR submission) | yes |
| **Reviewable** (feedback, CI, discussion) | yes |
| **Mergeable** | no until active CLA |

After CLA activation (P3c):

| State | Status |
| --- | --- |
| **Open** | yes |
| **Reviewable** | yes |
| **Mergeable** | only if CLA check passes **and** technical gates pass |

CLA approval alone does not guarantee merge. Code review, tests, security, licensing, and provenance checks still apply.

## Current merge workflow (CLA not active)

```
Contributor
   ↓
opens PR
   ↓
discussion / review allowed
   ↓
CLA workflow not active
   ↓
external code merge blocked
```

Unsigned pull requests may remain open and reviewable. Merge is blocked until P3c CLA activation and all other gates pass.

## Future merge workflow (after P3c activation)

```
PR opened
    ↓
CLA check runs
    ↓
CLA unsigned → PR remains open; contributor may sign; merge blocked
    ↓
CLA signed → CLA check green
    ↓
Normal technical review and CI continue
    ↓
Merge may be allowed if all gates pass
```

## Rules while CLA is not active

- External pull requests may be opened and reviewed.
- Do **not** merge external code pull requests that require contributor IP clearance.
- Provenance concerns block merge.
- Licensing concerns require maintainer review and, when needed, legal input.
- Issues, discussions, and feedback remain welcome.

## Rules once the contributor process is active

- No external code merge without an active CLA check for the contributor type.
- Maintainers cannot waive CLA or corporate authorization requirements ad hoc once active; exceptions require documented owner or legal approval.
- Third-party or employer-owned material without clear rights blocks merge.
- Dependency additions require license review.

## Contribution readiness vs. publication readiness

These are separate gates.

| Gate | Current status |
| --- | --- |
| Community license (MPL-2.0) | ready |
| Contribution policy documented | ready |
| Pull requests welcome | yes |
| CLA required for external code merge | yes (policy) |
| CLA draft prepared | yes (not published) |
| CLA legally reviewed | no |
| Receiving party confirmed | no |
| Signing workflow configured | no |
| CLA automation active | no |
| External code merge allowed | **no** |

Contribution blockers such as `cla-legal-review-required` do **not** block the first public package release while external code merges remain disabled until CLA activation.

## Related documents

- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [contributing-ip.md](./contributing-ip.md)
- [licensing.md](./licensing.md)
