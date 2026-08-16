import type { AccessibilityProfileDefinition } from "@a11yst/profiles";
import { listProfiles } from "@a11yst/profiles";

export function formatProfilesHuman(profiles: AccessibilityProfileDefinition[]): string {
  const lines: string[] = ["Accessibility profiles", ""];
  for (const profile of profiles) {
    lines.push(profile.id.toUpperCase());
    lines.push(`  Web implementation: ${profile.webImplemented ? "yes" : "no"}`);
    lines.push(`  Capabilities: ${profile.capabilities.join(", ")}`);
    lines.push("  Automated checks:");
    for (const check of profile.coverage.automatedChecks) {
      lines.push(`    - ${check}`);
    }
    if (profile.coverage.heuristicChecks.length > 0) {
      lines.push("  Heuristic checks:");
      for (const check of profile.coverage.heuristicChecks) {
        lines.push(`    - ${check}`);
      }
    }
    if (profile.coverage.manualChecks.length > 0) {
      lines.push("  Manual review still required:");
      for (const check of profile.coverage.manualChecks) {
        lines.push(`    - ${check}`);
      }
    }
    lines.push("  Limitations:");
    for (const limitation of profile.coverage.limitations) {
      lines.push(`    - ${limitation}`);
    }
    lines.push("");
  }
  lines.push("a11yst does not certify WCAG conformance.");
  return lines.join("\n");
}

export function formatProfilesJson(profiles: AccessibilityProfileDefinition[]): string {
  return `${JSON.stringify({ profiles }, null, 2)}\n`;
}

export function runProfiles(): AccessibilityProfileDefinition[] {
  return listProfiles();
}
