import type { Finding, FindingLocation } from "@a11yst/types";

export function findingLocation(finding: Finding): FindingLocation {
  if (finding.flowId && finding.checkpointId) {
    return {
      kind: "flow-checkpoint",
      flowId: finding.flowId,
      checkpointId: finding.checkpointId,
      profile: finding.profile,
      viewport: finding.viewport,
    };
  }

  return {
    kind: "route",
    route: finding.route ?? "(unknown)",
    routeId: finding.routeId,
    profile: finding.profile,
    viewport: finding.viewport,
  };
}

export function fingerprintKey(finding: Finding): string {
  const version = finding.fingerprintVersion ?? "1";
  return `${version}:${finding.fingerprint}`;
}
