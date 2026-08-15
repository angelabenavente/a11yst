import type { Severity } from "@a11yst/types";
import {
  compareSeverityDescending,
  severityRank,
} from "@a11yst/types";
import type { SarifLevel } from "./types.js";

export function mapSeverityToSarifLevel(severity: Severity): Exclude<SarifLevel, "none"> {
  switch (severity) {
    case "minor":
      return "note";
    case "medium":
      return "warning";
    case "high":
    case "critical":
      return "error";
    default:
      return "warning";
  }
}

export { compareSeverityDescending, severityRank };

export function maxSeverity(a: Severity, b: Severity): Severity {
  return severityRank(a) >= severityRank(b) ? a : b;
}
