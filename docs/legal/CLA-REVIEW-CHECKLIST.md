# Contributor agreement review checklist

This is an internal checklist for legal review and project owners. It is **not** a contract.

## Decisions requiring counsel

1. **Receiving party legal identity** — individual, company, foundation, or other entity that will receive contributor grants.
2. **Individual vs. corporate signing model** — when ICLA alone is sufficient vs. when CCLA or employer authorization is required.
3. **Copyright grant** — exact scope, exclusivity, duration, and territorial coverage.
4. **Sublicensing scope** — whether and how sublicenses may be granted to downstream recipients.
5. **Relicensing scope** — whether accepted Contributions may be relicensed under terms other than MPL-2.0 when legally permitted.
6. **Use in separately licensed commercial offerings** — explicit treatment of future proprietary or dual-licensed products.
7. **Patent grant** — scope, defensive termination, and corporate treatment.
8. **Patent termination** — conditions and effect on existing distributions.
9. **Representations** — contributor authority, originality, third-party material, confidentiality.
10. **Employer rights** — interaction with employment agreements and invention assignment.
11. **Moral rights** — treatment across relevant jurisdictions.
12. **Revocability** — whether contributor grants may be revoked and with what effect.
13. **Termination** — effect on merged Contributions and prior releases.
14. **Governing law and venue**.
15. **Minors and legal capacity**.
16. **Electronic signature mechanism** — tooling, identity verification, and audit trail.
17. **Privacy and PII handling** — what personal data is collected and how it is protected.
18. **Agreement storage** — where signed records live; must not be committed to the public source repository.
19. **Versioning and effective date** — how CLA updates apply to future vs. prior contributions.
20. **Existing contribution provenance** — review of historical authorship before opening external merges.

## Why DCO was not selected as the primary mechanism

The Developer Certificate of Origin (DCO) helps certify provenance and the right to contribute, but this project's IP strategy also requires evaluating additional rights needed to maintain Community releases and potential future separately licensed offerings.

DCO was **not selected** as the primary contributor IP mechanism for a11yst at this time. This is a project strategy choice, not a judgment on DCO's usefulness elsewhere.

## Before activating a contributor agreement

- [ ] Legal review completed on final ICLA and CCLA text
- [ ] Receiving party confirmed and named in active documents
- [ ] Final documents published at non-draft locations (for example, active `CLA.md` only after approval)
- [ ] Signing mechanism selected and tested
- [ ] Privacy and storage policy established for signed records
- [ ] Repository contribution docs updated to reflect active process
- [ ] Pull request workflow updated
- [ ] Pull requests may be opened before activation; external merge remains blocked before activation
- [ ] After activation, CLA check must become a required merge gate
- [ ] Validate actual CLA Assistant status/check name (if used)
- [ ] Validate branch protection or ruleset configuration
- [ ] Validate unsigned pull request behavior (merge blocked, PR remains open)
- [ ] Validate signed pull request behavior (CLA check green)
- [ ] Validate re-sign behavior after CLA version change
- [ ] Validate signer data and privacy handling
- [ ] Optional CLA/DCO bot configured only if desired and legally appropriate
- [ ] Historical provenance review completed if multiple authors exist

## Current status

| Item | Status |
| --- | --- |
| ICLA draft | prepared, **NOT ACTIVE** |
| CCLA draft | prepared, **NOT ACTIVE** |
| Receiving party | undecided |
| Signing workflow | not configured |
| CLA automation | not active |
| Pull requests | **welcome** |
| External code merge | **blocked until P3c CLA activation** |
