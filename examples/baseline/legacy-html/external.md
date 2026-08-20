# a11yst Accessibility Report
## Audit metadata
| Item | Value |
| --- | --- |
| Project | baseline-legacy-html |
| Audit ID | 20260817T205653054Z-1db61323c903 |
| Target | http://127.0.0.1:51958 |
| Framework | html |
| Date | 2026-08-17T20:56:53.053Z |
| Routes | 4 |
| Profiles | default |
| Viewports | desktop |
## Summary
| Severity | Affected elements |
| --- | ---: |
| CRITICAL | 4 |
| HIGH | 0 |
| MEDIUM | 0 |
| MINOR | 0 |
Unique issue groups: 4
Total affected elements: 4
## Status
| Item | Result |
| --- | --- |
| Audit | Completed |
| CI policy | Disabled |
The configured automated CI policy did not report any blocking breaches in this audit.
## Accessibility lifecycle
| Status | Count |
| --- | ---: |
| New | 1 |
| Known | 3 |
| Regressed | 0 |
| Resolved | 1 |
| Not compared | 1 |
## Findings
### CRITICAL · button-name · 1 affected element
Buttons must have discernible text
**Affected elements:**
1. Likely source: `index.html:48:8`
   - Route: /
   - Baseline: known
**Recommendation:**
- Give the button an accessible name
- Ensure the button exposes a descriptive accessible name to assistive technologies.
### CRITICAL · image-alt · 1 affected element
Images must have alternative text
**Affected elements:**
2. Likely source: `index.html:30:8`
   - Route: /
   - Baseline: known
**Recommendation:**
- Review image alternative text
- Determine whether the image is informative, decorative, or functional and provide appropriate alternative text.
### CRITICAL · label · 1 affected element
Form elements must have labels
**Affected elements:**
3. Likely source: `contact.html:47:10`
   - Route: /contact
   - Baseline: new
**Recommendation:**
- Associate a visible label with the control
- Ensure form controls have a programmatically associated label.
### CRITICAL · label · 1 affected element
Form elements must have labels
**Affected elements:**
4. Likely source: `review.html:47:10`
   - Route: /review
   - Baseline: known
**Recommendation:**
- Associate a visible label with the control
- Ensure form controls have a programmatically associated label.
## Comparison coverage
Comparison coverage is incomplete.
Findings outside the executed scope were not compared.
## Coverage
Automated barriers: 4
Heuristic findings: 0
Generated manual checks: 0
### default
Automated checks completed
- Browser accessibility checks completed
Manual accessibility review still required
- complete keyboard use
- zoom and reflow
- reduced motion behavior
- screen-reader behavior
- manual review
Not covered
- Does not simulate assistive technologies.
- Does not establish WCAG conformance.
### default
Automated checks completed
- Browser accessibility checks completed
Manual accessibility review still required
- complete keyboard use
- zoom and reflow
- reduced motion behavior
- screen-reader behavior
- manual review
Not covered
- Does not simulate assistive technologies.
- Does not establish WCAG conformance.
### default
Automated checks completed
- Browser accessibility checks completed
Manual accessibility review still required
- complete keyboard use
- zoom and reflow
- reduced motion behavior
- screen-reader behavior
- manual review
Not covered
- Does not simulate assistive technologies.
- Does not establish WCAG conformance.
### default
Automated checks completed
- Browser accessibility checks completed
Manual accessibility review still required
- complete keyboard use
- zoom and reflow
- reduced motion behavior
- screen-reader behavior
- manual review
Not covered
- Does not simulate assistive technologies.
- Does not establish WCAG conformance.
## Classified findings
| Disposition | Count |
| --- | ---: |
| false-positive | 1 |
| not-applicable | 0 |
| accepted-risk | 1 |
| third-party | 0 |
| manual-review | 0 |
| expired classifications | 0 |
## Resolved findings
| Rule | Project | Location | Profile | Previous severity |
| --- | --- | --- | --- | --- |
| button-name | baseline-legacy-html | route /fixed | default | critical |
## Reports
Markdown report: [reports/a11yst.md](reports/a11yst.md)
JSON results: `results.json`
> Automated testing does not establish WCAG conformance.
> Manual accessibility review remains necessary.
> A baseline records known accessibility debt.
> It does not make that debt accessible or compliant.
