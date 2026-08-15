import { describe, expect, it } from "vitest";
import {
  listProfiles,
  ProfileResolutionError,
  resolveProfile,
} from "@a11yst/profiles";

describe("@a11yst/profiles registry", () => {
  it("listProfiles returns all built-in accessibility profiles", () => {
    const profiles = listProfiles();
    const ids = profiles.map((profile) => profile.id);

    expect(ids).toEqual(["default", "keyboard", "large-text", "reduced-motion"]);
    expect(profiles.every((profile) => profile.webImplemented)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolveProfile returns the requested profile definition", () => {
    const keyboard = resolveProfile("keyboard");

    expect(keyboard.id).toBe("keyboard");
    expect(keyboard.capabilities).toContain("keyboard-navigation");
    expect(keyboard.coverage.automatedChecks.length).toBeGreaterThan(0);
  });

  it("resolveProfile throws ProfileResolutionError for unknown profiles", () => {
    expect(() => resolveProfile("unknown-profile")).toThrow(ProfileResolutionError);
    expect(() => resolveProfile("unknown-profile")).toThrow(/Unknown accessibility profile/);
    expect(() => resolveProfile("unknown-profile")).toThrow(/default, keyboard, large-text, reduced-motion/);
  });
});
