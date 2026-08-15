export type TerminalPresentationMode = "plain" | "interactive";

export type TerminalCapabilities = {
  isTTY: boolean;
  isStderrTTY: boolean;
  isCI: boolean;
  isDumbTerminal: boolean;
  noColor: boolean;
  supportsColor: boolean;
};

/** Injectable inputs for terminal capability detection (tests and CLI boundary). */
export type TerminalCapabilitiesInput = {
  isTTY?: boolean;
  isStderrTTY?: boolean;
  isCI?: boolean;
  term?: string;
  noColor?: boolean;
};

export type OutputKind = "human" | "machine" | "artifact";

export type BrandHeaderOptions = {
  mode?: TerminalPresentationMode;
  tagline?: boolean;
};
