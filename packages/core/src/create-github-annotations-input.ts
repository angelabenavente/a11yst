import type { GitHubAnnotationInput } from "@a11yst/reporters";
import type { AuditExecutionResult, ResolvedCiPolicyConfig } from "@a11yst/types";
import { createMarkdownInputFromAuditResult } from "./create-markdown-input.js";

export function createGitHubAnnotationsInputFromAuditResult(
  result: AuditExecutionResult,
  policy?: ResolvedCiPolicyConfig,
): GitHubAnnotationInput {
  return {
    ...createMarkdownInputFromAuditResult(result, policy),
    runs: result.runs,
  };
}
