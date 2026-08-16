import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateContributionReadiness,
  isExternalCodeMergeAllowed,
} from "../../helpers/release/contribution-readiness.js";
import { evaluateReleaseReadiness } from "../../helpers/release/readiness.js";
import { getRepoRoot } from "../../helpers/release/workspace-packages.js";

describe("contribution governance readiness", () => {
  it("models PRs welcome separately from external merge blocked until CLA", async () => {
    const contribution = evaluateContributionReadiness();
    const publication = await evaluateReleaseReadiness({
      technical: { packaging: true, consumerInstall: true },
    });

    expect(contribution.communityLicenseReady).toBe(true);
    expect(contribution.contributionPolicyDocumented).toBe(true);
    expect(contribution.pullRequestsWelcome).toBe(true);
    expect(contribution.codePullRequestsWelcome).toBe(true);
    expect(contribution.documentationPullRequestsWelcome).toBe(true);
    expect(contribution.issueContributionsWelcome).toBe(true);
    expect(contribution.claRequiredForExternalCodeMerge).toBe(true);
    expect(contribution.claDraftPresent).toBe(true);
    expect(contribution.claLegallyReviewed).toBe(false);
    expect(contribution.receivingPartyConfirmed).toBe(false);
    expect(contribution.signingMechanismConfigured).toBe(false);
    expect(contribution.claAutomationActive).toBe(false);
    expect(contribution.externalCodeMergeAllowed).toBe(false);
    expect(contribution.blockers).toContain("external-code-merge-blocked-until-cla-active");
    expect(contribution.blockers).toContain("cla-legal-review-required");
    expect(contribution.blockers).toContain("cla-receiving-party-undecided");
    expect(contribution.blockers).toContain("cla-signing-workflow-not-configured");
    expect(contribution.blockers).toContain("cla-automation-not-active");
    expect(contribution.blockers).not.toContain("external-pull-requests-disabled" as never);
    expect(isExternalCodeMergeAllowed(contribution)).toBe(false);

    expect(publication.publication.license).toBe(true);
    expect(publication.blockers).not.toContain("external-code-merge-blocked-until-cla-active" as never);
    expect(publication.blockers).not.toContain("cla-legal-review-required" as never);
  });

  it("allows external merge only when all contribution gates are satisfied", () => {
    const ready = evaluateContributionReadiness({
      claLegallyReviewed: true,
      receivingPartyConfirmed: true,
      signingMechanismConfigured: true,
      claAutomationActive: true,
      externalCodeMergeAllowed: true,
    });
    expect(ready.blockers).toEqual([]);
    expect(isExternalCodeMergeAllowed(ready)).toBe(true);
  });

  it("does not treat CLA signing as automatic merge approval", () => {
    const signedButBlocked = evaluateContributionReadiness({
      claLegallyReviewed: true,
      receivingPartyConfirmed: true,
      signingMechanismConfigured: true,
      claAutomationActive: true,
      externalCodeMergeAllowed: false,
    });
    expect(signedButBlocked.claAutomationActive).toBe(true);
    expect(isExternalCodeMergeAllowed(signedButBlocked)).toBe(false);
  });

  it("documents release contributor policy with PRs welcome and merge blocked", async () => {
    const release = await readFile(join(getRepoRoot(), "docs/release.md"), "utf8");
    expect(release).toMatch(/Contributor policy.*prepared|contributor IP/i);
    expect(release).toMatch(/Active external CLA.*no|external CLA.*no/i);
    expect(release).toMatch(/External pull requests.*welcome|pull requests.*welcome/i);
    expect(release).toMatch(/blocked until CLA|cannot be merged/i);
    expect(release).not.toMatch(/By submitting a pull request you agree/i);
    expect(release).not.toMatch(/external code contributions are not accepted/i);
  });
});
