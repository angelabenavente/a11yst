import type {
  AccessibilityProfile,
  NormalizedProfileOptions,
  ProfileCapability,
  ProfileCoverage,
} from "@a11yst/types";
import { PROFILE_COVERAGE } from "./order.js";

export class ProfileResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileResolutionError";
  }
}

export interface AccessibilityProfileDefinition {
  id: AccessibilityProfile;
  capabilities: ProfileCapability[];
  coverage: ProfileCoverage;
  webImplemented: boolean;
}

const DEFINITIONS: AccessibilityProfileDefinition[] = [
  {
    id: "default",
    capabilities: PROFILE_COVERAGE.default.capabilities,
    coverage: PROFILE_COVERAGE.default,
    webImplemented: true,
  },
  {
    id: "keyboard",
    capabilities: PROFILE_COVERAGE.keyboard.capabilities,
    coverage: PROFILE_COVERAGE.keyboard,
    webImplemented: true,
  },
  {
    id: "large-text",
    capabilities: PROFILE_COVERAGE["large-text"].capabilities,
    coverage: PROFILE_COVERAGE["large-text"],
    webImplemented: true,
  },
  {
    id: "reduced-motion",
    capabilities: PROFILE_COVERAGE["reduced-motion"].capabilities,
    coverage: PROFILE_COVERAGE["reduced-motion"],
    webImplemented: true,
  },
];

export function listProfiles(): AccessibilityProfileDefinition[] {
  return [...DEFINITIONS];
}

export function resolveProfile(id: string): AccessibilityProfileDefinition {
  const profile = DEFINITIONS.find((entry) => entry.id === id);
  if (!profile) {
    throw new ProfileResolutionError(`Unknown accessibility profile "${id}". Known profiles: default, keyboard, large-text, reduced-motion.`);
  }
  return profile;
}

export function resolveProfileOptions(
  profileOptions: NormalizedProfileOptions[],
  profile: AccessibilityProfile,
): NormalizedProfileOptions {
  const match = profileOptions.find((entry) => entry.id === profile);
  if (match) return match;
  switch (profile) {
    case "default":
      return { id: "default" };
    case "keyboard":
      return {
        id: "keyboard",
        maxTabStops: 100,
        detectFocusTraps: true,
        captureFocusEvidence: true,
      };
    case "large-text":
      return {
        id: "large-text",
        textScale: 2,
        detectHorizontalOverflow: true,
        compareWithDefault: true,
        overlapTolerancePx: 8,
      };
    case "reduced-motion":
      return {
        id: "reduced-motion",
        emulatePreference: true,
        inspectAnimations: true,
        minimumSignificantDurationMs: 300,
        compareWithDefault: true,
      };
  }
}

export function assertUniqueProfileIds(profileOptions: NormalizedProfileOptions[]): void {
  const seen = new Set<string>();
  for (const option of profileOptions) {
    if (seen.has(option.id)) {
      throw new ProfileResolutionError(`Duplicate accessibility profile id "${option.id}" in configuration.`);
    }
    seen.add(option.id);
  }
}
