export const HUMAN_STATUS_LABELS = {
  success: "Success",
  warning: "Warning",
  error: "Error",
  info: "Info",
  review: "Review",
} as const;

export type HumanStatusKind = keyof typeof HUMAN_STATUS_LABELS;

export function formatHumanStatus(kind: HumanStatusKind, detail: string): string {
  return `${HUMAN_STATUS_LABELS[kind]}: ${detail}`;
}

export function formatHumanHint(message: string): string {
  return `Hint: ${message}`;
}
