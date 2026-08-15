import type { AccessibilityProfile } from "@a11yst/types";

function sanitize(segment: string): string {
  return segment
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildFlowSessionId(parts: {
  projectName: string;
  flowId: string;
  profile: AccessibilityProfile;
  viewportName: string;
}): string {
  return [
    "flow",
    sanitize(parts.projectName),
    sanitize(parts.flowId),
    sanitize(parts.profile),
    sanitize(parts.viewportName),
  ].join("::");
}

export function buildFlowCheckpointRunId(parts: {
  projectName: string;
  flowId: string;
  checkpointId: string;
  profile: AccessibilityProfile;
  viewportName: string;
}): string {
  return [
    "flow",
    sanitize(parts.projectName),
    sanitize(parts.flowId),
    sanitize(parts.checkpointId),
    sanitize(parts.profile),
    sanitize(parts.viewportName),
  ].join("::");
}
