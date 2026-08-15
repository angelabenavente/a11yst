import { describe, expect, it } from "vitest";
import { resolveTerminalCapabilities } from "../../../../packages/cli/src/presentation/capabilities.js";
import {
  createBrandHeader,
  createPlainBrandHeader,
} from "../../../../packages/cli/src/presentation/brand-header.js";
import { resolveTerminalPresentationMode } from "../../../../packages/cli/src/presentation/mode.js";

describe("resolveTerminalPresentationMode", () => {
  it("selects interactive for a normal TTY", () => {
    const caps = resolveTerminalCapabilities({ isTTY: true, isCI: false, term: "xterm-256color" });
    expect(resolveTerminalPresentationMode(caps)).toBe("interactive");
  });

  it("selects plain for non-TTY output", () => {
    const caps = resolveTerminalCapabilities({ isTTY: false, isCI: false, term: "xterm-256color" });
    expect(resolveTerminalPresentationMode(caps)).toBe("plain");
  });

  it("selects plain in CI even when TTY", () => {
    const caps = resolveTerminalCapabilities({ isTTY: true, isCI: true, term: "xterm-256color" });
    expect(resolveTerminalPresentationMode(caps)).toBe("plain");
  });

  it("selects plain for TERM=dumb", () => {
    const caps = resolveTerminalCapabilities({ isTTY: true, isCI: false, term: "dumb" });
    expect(resolveTerminalPresentationMode(caps)).toBe("plain");
  });

  it("preserves identity text under NO_COLOR without ANSI", () => {
    const caps = resolveTerminalCapabilities({
      isTTY: true,
      isCI: false,
      term: "xterm-256color",
      noColor: true,
    });
    expect(caps.supportsColor).toBe(false);
    const header = createBrandHeader({
      mode: resolveTerminalPresentationMode(caps),
      tagline: true,
    });
    expect(header).toContain("a11yst");
    expect(header).toContain("Your accessibility analyst.");
    // eslint-disable-next-line no-control-regex
    expect(header).not.toMatch(/\x1b\[[0-9;]*m/);
  });

  it("defaults unknown terminals to plain when not TTY", () => {
    const caps = resolveTerminalCapabilities({ isTTY: false, term: undefined });
    expect(resolveTerminalPresentationMode(caps)).toBe("plain");
    expect(createPlainBrandHeader()).toContain("a11yst");
  });
});
