import type {
  AccessibilityProfile,
  FindingAutomation,
  FindingConfidence,
  FindingComparison,
  ProfileFinding,
  Severity,
} from "@a11yst/types";

export interface RuleMetadata {
  id: string;
  title: string;
  description: string;
  profile?: AccessibilityProfile;
  context?: "flow" | "profile";
  defaultSeverity: Severity;
  confidence: FindingConfidence;
  automation: FindingAutomation;
  standards: string[];
  limitations: string[];
}

export interface RuleEvaluationContext {
  projectName: string;
  profile: AccessibilityProfile;
  routeId?: string;
  routeName?: string;
  route?: string;
  url?: string;
  viewport?: string;
  flowId?: string;
  checkpointId?: string;
}

export interface RuleFindingInput {
  ruleId: string;
  title: string;
  description?: string;
  severity?: Severity;
  confidence?: FindingConfidence;
  automation?: FindingAutomation;
  target: string[];
  comparison?: FindingComparison;
  standards?: string[];
}

export function buildA11ystFinding(
  input: RuleFindingInput,
  context: RuleEvaluationContext,
  metadata: RuleMetadata,
): ProfileFinding {
  const targetKey = input.target.join("|") || "document";
  const fingerprint = context.flowId
    ? [
        input.ruleId,
        context.projectName,
        context.flowId,
        context.checkpointId ?? "",
        context.profile,
        context.viewport ?? "",
        targetKey,
      ].join("::")
    : [
        input.ruleId,
        context.projectName,
        context.route ?? "",
        context.profile,
        context.viewport ?? "",
        targetKey,
      ].join("::");

  return {
    id: fingerprint,
    fingerprint,
    fingerprintVersion: "1",
    source: "a11yst",
    ruleId: input.ruleId,
    title: input.title,
    description: input.description ?? metadata.description,
    severity: input.severity ?? metadata.defaultSeverity,
    projectName: context.projectName,
    profile: context.profile,
    routeId: context.routeId,
    routeName: context.routeName,
    route: context.route,
    url: context.url,
    viewport: context.viewport,
    target: input.target,
    standards: input.standards ?? metadata.standards,
    confidence: input.confidence ?? metadata.confidence,
    automation: input.automation ?? metadata.automation,
    ...(input.comparison ? { comparison: input.comparison } : {}),
    ...(context.flowId ? { flowId: context.flowId } : {}),
    ...(context.checkpointId ? { checkpointId: context.checkpointId } : {}),
  };
}
