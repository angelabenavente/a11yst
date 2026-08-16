import type { AuditRunResult, Finding } from "@a11yst/types";
import type { GitHubAnnotationInput } from "@a11yst/reporters";
import { run as baselineRun } from "../../baseline/fixtures.js";
import {
  baseInput,
  expiredPolicyBreach,
  finding,
  newPolicyBreach,
  policyEvaluation,
  policyNotEvaluated,
  regressionPolicyBreach,
  SECRET_PASSWORD,
  SECRET_TOKEN,
} from "../markdown/fixtures.js";

export { SECRET_PASSWORD, SECRET_TOKEN };

export function completedRouteRun(overrides: Partial<AuditRunResult> = {}): AuditRunResult {
  return baselineRun({
    projectName: "storefront",
    route: "/checkout",
    profile: "default",
    status: "completed",
    durationMs: 1250,
    ...overrides,
  });
}

export function failedRouteRun(overrides: Partial<AuditRunResult> = {}): AuditRunResult {
  return baselineRun({
    projectName: "storefront",
    route: "/settings",
    profile: "keyboard",
    status: "failed",
    durationMs: 500,
    diagnostics: [
      {
        code: "navigation-timeout",
        severity: "error",
        message: "Timed out waiting for route readiness.",
      },
    ],
    ...overrides,
  });
}

export function failedRunWithSecrets(overrides: Partial<AuditRunResult> = {}): AuditRunResult {
  return failedRouteRun({
    diagnostics: [
      {
        code: "auth-error",
        severity: "error",
        message: `Invalid password "${SECRET_PASSWORD}" or token ${SECRET_TOKEN}`,
      },
    ],
    ...overrides,
  });
}

export function githubInput(overrides: Partial<GitHubAnnotationInput> = {}): GitHubAnnotationInput {
  return {
    ...baseInput(),
    runs: [],
    ...overrides,
  };
}

export function findingWithSourceLocation(
  overrides: Partial<Finding> & {
    sourceLocation?: {
      uri: string;
      startLine: number;
      startColumn?: number;
      endLine?: number;
      endColumn?: number;
    };
  } = {},
): Finding & {
  sourceLocation: {
    uri: string;
    startLine: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
  };
} {
  const base = finding({
    fingerprint: "button-name|storefront|/checkout|default|desktop|#submit",
    ...overrides,
  });
  return {
    ...base,
    sourceLocation: overrides.sourceLocation ?? {
      uri: "src/components/Submit.tsx",
      startLine: 12,
      startColumn: 4,
      endLine: 12,
      endColumn: 20,
    },
  };
}

export function findingWithInvalidSourceLocation(overrides: Partial<Finding> = {}): Finding & {
  sourceLocation: { uri: string; startLine: number };
} {
  return {
    ...finding({
      fingerprint: "button-name|storefront|/checkout|default|desktop|#submit",
      ...overrides,
    }),
    sourceLocation: {
      uri: "/etc/passwd",
      startLine: 1,
    },
  };
}

export {
  expiredPolicyBreach,
  newPolicyBreach,
  policyEvaluation,
  policyNotEvaluated,
  regressionPolicyBreach,
};
