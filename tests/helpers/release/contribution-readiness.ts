export const CONTRIBUTION_BLOCKER_IDS = [
  "external-code-merge-blocked-until-cla-active",
  "cla-legal-review-required",
  "cla-receiving-party-undecided",
  "cla-signing-workflow-not-configured",
  "cla-automation-not-active",
] as const;

export type ContributionBlockerId = (typeof CONTRIBUTION_BLOCKER_IDS)[number];

export type ContributionReadiness = {
  communityLicenseReady: boolean;
  contributionPolicyDocumented: boolean;
  pullRequestsWelcome: boolean;
  codePullRequestsWelcome: boolean;
  documentationPullRequestsWelcome: boolean;
  issueContributionsWelcome: boolean;
  claRequiredForExternalCodeMerge: boolean;
  claDraftPresent: boolean;
  claLegallyReviewed: boolean;
  receivingPartyConfirmed: boolean;
  signingMechanismConfigured: boolean;
  claAutomationActive: boolean;
  externalCodeMergeAllowed: boolean;
  blockers: ContributionBlockerId[];
};

export type ContributionReadinessInput = Partial<
  Omit<ContributionReadiness, "blockers">
>;

export function evaluateContributionReadiness(
  input: ContributionReadinessInput = {},
): ContributionReadiness {
  const communityLicenseReady = input.communityLicenseReady ?? true;
  const contributionPolicyDocumented = input.contributionPolicyDocumented ?? true;
  const pullRequestsWelcome = input.pullRequestsWelcome ?? true;
  const codePullRequestsWelcome = input.codePullRequestsWelcome ?? pullRequestsWelcome;
  const documentationPullRequestsWelcome =
    input.documentationPullRequestsWelcome ?? pullRequestsWelcome;
  const issueContributionsWelcome = input.issueContributionsWelcome ?? true;
  const claRequiredForExternalCodeMerge =
    input.claRequiredForExternalCodeMerge ?? true;
  const claDraftPresent = input.claDraftPresent ?? true;
  const claLegallyReviewed = input.claLegallyReviewed ?? false;
  const receivingPartyConfirmed = input.receivingPartyConfirmed ?? false;
  const signingMechanismConfigured = input.signingMechanismConfigured ?? false;
  const claAutomationActive = input.claAutomationActive ?? false;
  const externalCodeMergeAllowed = input.externalCodeMergeAllowed ?? false;

  const blockers: ContributionBlockerId[] = [];

  if (!externalCodeMergeAllowed) {
    blockers.push("external-code-merge-blocked-until-cla-active");
  }
  if (!claLegallyReviewed) {
    blockers.push("cla-legal-review-required");
  }
  if (!receivingPartyConfirmed) {
    blockers.push("cla-receiving-party-undecided");
  }
  if (!signingMechanismConfigured) {
    blockers.push("cla-signing-workflow-not-configured");
  }
  if (!claAutomationActive) {
    blockers.push("cla-automation-not-active");
  }

  return {
    communityLicenseReady,
    contributionPolicyDocumented,
    pullRequestsWelcome,
    codePullRequestsWelcome,
    documentationPullRequestsWelcome,
    issueContributionsWelcome,
    claRequiredForExternalCodeMerge,
    claDraftPresent,
    claLegallyReviewed,
    receivingPartyConfirmed,
    signingMechanismConfigured,
    claAutomationActive,
    externalCodeMergeAllowed,
    blockers,
  };
}

export function isExternalCodeMergeAllowed(
  readiness: ContributionReadiness,
): boolean {
  return readiness.externalCodeMergeAllowed && readiness.blockers.length === 0;
}

/** @deprecated Use isExternalCodeMergeAllowed */
export function isExternalCodeContributionReady(
  readiness: ContributionReadiness,
): boolean {
  return isExternalCodeMergeAllowed(readiness);
}
