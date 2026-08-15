import type {
  ProfileConfigEntry,
  ProfileOptionsConfig,
  NormalizedProfileOptions,
  AccessibilityProfile,
} from "@a11yst/types";

const PROFILE_IDS: AccessibilityProfile[] = [
  "default",
  "keyboard",
  "large-text",
  "reduced-motion",
];

export function isAccessibilityProfile(value: string): value is AccessibilityProfile {
  return (PROFILE_IDS as string[]).includes(value);
}

export function normalizeProfileEntry(entry: ProfileConfigEntry): NormalizedProfileOptions {
  if (typeof entry === "string") {
    return defaultOptionsForProfile(entry);
  }
  return normalizeStructuredProfile(entry);
}

export function normalizeProfileEntries(
  entries: ProfileConfigEntry[] | undefined,
): NormalizedProfileOptions[] {
  const source = entries && entries.length > 0 ? entries : [{ id: "default" as const }];
  const normalized = source.map(normalizeProfileEntry);
  const seen = new Set<string>();
  for (const option of normalized) {
    if (seen.has(option.id)) {
      throw new Error(`Duplicate accessibility profile id "${option.id}" in configuration.`);
    }
    seen.add(option.id);
  }
  return normalized;
}

export function profileIdsFromOptions(options: NormalizedProfileOptions[]): AccessibilityProfile[] {
  return options.map((option) => option.id);
}

function defaultOptionsForProfile(profile: AccessibilityProfile): NormalizedProfileOptions {
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

function normalizeStructuredProfile(entry: ProfileOptionsConfig): NormalizedProfileOptions {
  switch (entry.id) {
    case "default":
      return { id: "default" };
    case "keyboard":
      return {
        id: "keyboard",
        maxTabStops: entry.maxTabStops ?? 100,
        detectFocusTraps: entry.detectFocusTraps ?? true,
        captureFocusEvidence: entry.captureFocusEvidence ?? true,
      };
    case "large-text":
      return {
        id: "large-text",
        textScale: entry.textScale ?? 2,
        detectHorizontalOverflow: entry.detectHorizontalOverflow ?? true,
        compareWithDefault: entry.compareWithDefault ?? true,
        overlapTolerancePx: entry.overlapTolerancePx ?? 8,
      };
    case "reduced-motion":
      return {
        id: "reduced-motion",
        emulatePreference: entry.emulatePreference ?? true,
        inspectAnimations: entry.inspectAnimations ?? true,
        minimumSignificantDurationMs: entry.minimumSignificantDurationMs ?? 300,
        compareWithDefault: entry.compareWithDefault ?? true,
      };
  }
}
