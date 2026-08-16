# Security Policy

## Supported versions

a11yst is in pre-release development. Only the latest development line in this repository is evaluated for security fixes. No long-term support commitment exists for provisional `0.x` versions.

| Version | Supported |
| --- | --- |
| Current development (`0.1.0` provisional) | yes |
| Earlier unpublished snapshots | no |

## Reporting a vulnerability

Do **not** disclose suspected security vulnerabilities in public issues, pull requests, or discussion threads.

Use the private security reporting mechanism of the repository hosting this project **when that mechanism is available and confirmed for this repository**. Until a concrete reporting channel is confirmed for public release, treat security contact as a release decision that must be finalized before the first public publish.

Reports will be reviewed as capacity allows during pre-release development. No response-time SLA is promised.

## Scope

Security reports relevant to a11yst include, but are not limited to:

- accidental secret exposure in results, reports, or diagnostics;
- unsafe path handling or repository-root leakage;
- command injection or unsafe shell invocation in the CLI;
- unexpected network behavior during audits or installs;
- package supply-chain or tarball integrity issues;
- orphaned browser or dev-server processes after failed audits.

Out of scope: accessibility findings in applications you audit with a11yst, unless they reveal a vulnerability in a11yst itself.

## Disclosure

a11yst does not guarantee coordinated disclosure timelines during pre-release development. If you report a vulnerability, include enough detail to reproduce the issue and the version or commit you tested.

Automated accessibility checks do not establish WCAG conformance and do not replace manual accessibility testing.
