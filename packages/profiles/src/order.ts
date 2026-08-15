import type { AccessibilityProfile, ProfileCapability, ProfileCoverage } from "@a11yst/types";

export const PROFILE_ORDER: AccessibilityProfile[] = [
  "default",
  "keyboard",
  "large-text",
  "reduced-motion",
];

export const PROFILE_VERSION = "1.0.0";

export function compareProfileOrder(a: AccessibilityProfile, b: AccessibilityProfile): number {
  return PROFILE_ORDER.indexOf(a) - PROFILE_ORDER.indexOf(b);
}

export function sortRunsByProfile<T extends { profile: AccessibilityProfile }>(runs: T[]): T[] {
  return [...runs].sort((a, b) => compareProfileOrder(a.profile, b.profile));
}

export const PROFILE_COVERAGE: Record<AccessibilityProfile, ProfileCoverage & { capabilities: ProfileCapability[] }> = {
  default: {
    capabilities: ["axe"],
    automatedChecks: ["Browser accessibility checks completed"],
    heuristicChecks: [],
    manualChecks: [
      "complete keyboard use",
      "zoom and reflow",
      "reduced motion behavior",
      "screen-reader behavior",
      "manual review",
    ],
    limitations: [
      "Does not simulate assistive technologies.",
      "Does not establish WCAG conformance.",
    ],
  },
  keyboard: {
    capabilities: ["axe", "keyboard-navigation", "focus-observation"],
    automatedChecks: ["focus sequence", "keyboard reachability heuristics", "positive tabindex detection"],
    heuristicChecks: ["focus traps in initial state", "unreachable native controls"],
    manualChecks: ["appropriateness of focus order", "complete operation of all controls", "focus indicator appearance"],
    limitations: ["Does not operate controls beyond focus traversal.", "Modal focus traps during interaction are not covered."],
  },
  "large-text": {
    capabilities: ["axe", "text-scaling", "layout-comparison"],
    automatedChecks: ["200% text scaling", "overflow and overlap heuristics"],
    heuristicChecks: ["clipping", "control truncation", "fixed dimension containers"],
    manualChecks: ["Reflow at 400% is not fully covered by the current large-text profile."],
    limitations: ["Uses injected text scaling, not browser zoom.", "Does not verify full 400% reflow."],
  },
  "reduced-motion": {
    capabilities: ["axe", "media-emulation", "motion-inspection"],
    automatedChecks: ["prefers-reduced-motion emulation", "animation comparison"],
    heuristicChecks: ["infinite animations", "unchanged motion", "smooth scroll behavior"],
    manualChecks: ["whether remaining motion is essential"],
    limitations: ["Cannot judge essential motion automatically.", "Short decorative fades may remain."],
  },
};
