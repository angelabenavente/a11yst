import type { Finding } from "@a11yst/types";
import type { SarifLogicalLocation, SarifResult } from "./types.js";

export function buildLogicalLocation(finding: Finding): SarifLogicalLocation {
  if (finding.flowId && finding.checkpointId) {
    return {
      name: finding.checkpointId,
      fullyQualifiedName: `${finding.projectName}:flow:${finding.flowId}:checkpoint:${finding.checkpointId}`,
      kind: "flow-checkpoint",
    };
  }

  const route = finding.route ?? finding.url ?? "(unknown-route)";
  return {
    name: route,
    fullyQualifiedName: `${finding.projectName}:route:${route}`,
    kind: "route",
  };
}

export function logicalLocationSortKey(location: SarifLogicalLocation): string {
  return `${location.kind ?? ""}:${location.fullyQualifiedName ?? location.name}`;
}

export function getResultLogicalLocation(
  result: SarifResult,
): SarifLogicalLocation | undefined {
  for (const location of result.locations ?? []) {
    const logical = location.logicalLocations?.[0];
    if (logical) {
      return logical;
    }
  }
  return undefined;
}
