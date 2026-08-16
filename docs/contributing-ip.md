# Contributor intellectual property guide

This document explains how a11yst handles contributor rights. It is **informational**, not a contract.

For development workflow, see [CONTRIBUTING.md](../CONTRIBUTING.md). For governance rules, see [contribution-governance.md](./contribution-governance.md).

## Why contribution provenance matters

a11yst Community is distributed under MPL-2.0. Maintainers need confidence that submitted material may legally become part of the project and that contributors understand what rights they are granting before any agreement becomes active.

## Current Community license

a11yst Community is licensed under the **Mozilla Public License 2.0 (MPL-2.0)**.

See [LICENSE](../LICENSE) and [docs/licensing.md](./licensing.md).

## Contributor retains ownership

Contributors will **not** be required to assign copyright as the project's default contribution model.

The final contributor agreement will define the precise license granted to the project and remains subject to legal review.

## CLA model being prepared

a11yst is preparing an Individual Contributor License Agreement (ICLA) and Corporate Contributor License Agreement (CCLA) framework.

Draft agreements are being prepared. They are **not legally active** and are not published in this repository.

No contributor is bound by a draft until legal review, Receiving Party confirmation, and an explicit activation process.

**By submitting a pull request today, you do not agree to any a11yst CLA.**

## Why CLA instead of DCO alone

The Developer Certificate of Origin (DCO) helps certify provenance and the right to contribute. It was **not selected** as the primary contributor IP mechanism for this project because the IP strategy also requires evaluating additional rights needed to maintain Community releases and potential future separately licensed offerings.

This does not criticize DCO; it reflects a11yst's current planning needs.

## Community and future commercial offerings

- a11yst Community is MPL-2.0.
- The project may develop separately licensed commercial products or services in the future.
- Accepted external contributions may eventually require a contributor agreement that gives the project sufficient rights to maintain both Community distribution and potential separately licensed offerings.
- Any such rights will be explicit in the final, legally reviewed agreement.
- Contributors should be able to understand the rights they are granting before signing.

This documentation does **not** mean your contribution will be sold, that Community code automatically becomes proprietary, or that the project acquires ownership of your contribution.

## Employer-owned work

Contributors may be subject to:

- employment agreements;
- invention assignment policies;
- employer intellectual property rules.

You are responsible for determining whether you have the right to contribute. If your employer owns the work, corporate authorization may be required before a contribution can be accepted once the contributor process is active.

This is general guidance, not employment or legal advice.

## Individual vs. corporate contributors

When the contributor process is active:

- **Individual contributors** will likely sign the final ICLA when the contribution IP belongs to them personally.
- **Employer-owned contributions** may additionally require corporate authorization under the CCLA or equivalent employer approval.

Contributors are responsible for determining whether employer permission is required. The project does not assume that every employed contributor needs a corporate agreement in all cases.

## Third-party code

Do not submit:

- copied proprietary code;
- code copied from sources without compatible rights (for example, uncredited Stack Overflow snippets with unclear licensing);
- code generated from confidential employer repositories;
- third-party source without identifying license and provenance.

Identify third-party material in pull requests when the contributor process is active.

## Confidential information

Do not submit confidential information, trade secrets, or material you are not authorized to disclose.

## AI-assisted contributions

Contributors remain responsible for having the right to submit all material included in a contribution, regardless of tools used to create it.

This project does not make absolute claims about ownership of AI-generated output; provenance and authorization still matter.

## Dependency contributions

If a pull request adds a new dependency, include:

- package name;
- reason for inclusion;
- license;
- whether it is runtime or development-only.

Reviewers should check license compatibility before merge once external contributions are accepted.

## Large code donations

Large pre-existing codebases should not enter through a normal pull request without provenance review. They may require a separate software grant or custom agreement. Contact maintainers before proposing such a donation.

No software grant template is active yet.

## Contribution types

### Feedback that may not require a CLA

Bug reports, issue reproduction steps, feature ideas, and typo suggestions may not require the same contribution agreement process depending on the nature of the contribution. When in doubt, ask maintainers.

### Code and substantive documentation

Once the contributor process is active, code and copyright-significant documentation contributions will likely require the finalized contributor agreement process.

## Current external code contribution status

**External pull requests are welcome.**

Issues, bug reports, feature proposals, and documentation suggestions are welcome. Code pull requests may be opened, reviewed, and discussed.

The CLA is **not legally active**. Merge of external copyright-significant code remains gated until the CLA workflow is activated (P3c).

Opening a pull request does not imply merge approval, and does not activate or substitute for any CLA.

**By submitting a pull request today, you do not agree to any a11yst CLA.**

## What will change when the CLA becomes active (P3c)

When legal review completes and maintainers activate the process:

1. Final ICLA/CCLA documents will be published at non-draft locations.
2. A signing workflow and CLA check will be configured.
3. CONTRIBUTING.md and pull request templates will reflect the active workflow.
4. External code pull requests will require a passing CLA check before merge.
5. CLA approval will remain separate from technical review and CI.
6. Merged contributions will continue to be distributed in Community under MPL-2.0 unless a file clearly states another compatible arrangement.

## Privacy

The eventual signing workflow must define how contributor agreement records and personal information are stored and protected.

Signed agreement records must **not** be committed to the public source repository.
