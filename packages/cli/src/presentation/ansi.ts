import type { Severity } from "@a11yst/types";

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}

export type AnsiStyle = {
  bold?: boolean;
  dim?: boolean;
  fg?: string;
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

const SEVERITY_FG: Record<Severity, string> = {
  critical: "\x1b[35m",
  high: "\x1b[31m",
  medium: "\x1b[33m",
  minor: "\x1b[36m",
};

export function styleText(text: string, style: AnsiStyle, colorEnabled: boolean): string {
  if (!colorEnabled) {
    return text;
  }
  const codes: string[] = [];
  if (style.bold) {
    codes.push(BOLD);
  }
  if (style.dim) {
    codes.push(DIM);
  }
  if (style.fg) {
    codes.push(style.fg);
  }
  if (codes.length === 0) {
    return text;
  }
  return `${codes.join("")}${text}${RESET}`;
}

export function styleSeverityLabel(severity: Severity, colorEnabled: boolean): string {
  const label = severity.toUpperCase();
  if (!colorEnabled) {
    return label;
  }
  return styleText(label, { bold: true, fg: SEVERITY_FG[severity] }, true);
}

export function padVisible(text: string, width: number): string {
  const len = visibleLength(text);
  if (len >= width) {
    return text;
  }
  return `${text}${" ".repeat(width - len)}`;
}
