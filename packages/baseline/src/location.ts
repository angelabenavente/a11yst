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
    route: finding.route ?? finding.url ?? "",
    routeId: finding.routeId,
    profile: finding.profile,
    viewport: finding.viewport,
  };
}

export function locationKey(location: FindingLocation): string {
  if (location.kind === "route") {
    return [
      "route",
      location.route,
      location.routeId ?? "",
      location.profile,
      location.viewport ?? "",
    ].join("|");
  }

  return [
    "flow-checkpoint",
    location.flowId,
    location.checkpointId,
    location.profile,
    location.viewport ?? "",
  ].join("|");
}

export function fingerprintVersionOf(finding: Finding): "1" {
  return finding.fingerprintVersion ?? "1";
}
