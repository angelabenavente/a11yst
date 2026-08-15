import type {
  FindingClassification,
  FindingDisposition,
} from "@a11yst/types";
import {
  assertFutureOrTodayCalendarDate,
  parseCalendarDate,
  type Clock,
  systemClock,
} from "./clock.js";

export class ClassificationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClassificationValidationError";
  }
}

export function validateClassification(
  classification: FindingClassification,
  options: { clock?: Clock; allowPastExpiry?: boolean } = {},
): void {
  const clock = options.clock ?? systemClock;
  const { disposition, reason, owner, expiresAt, reviewAt, scope } = classification;

  if (!reason.trim()) {
    throw new ClassificationValidationError("Classification reason is required.");
  }

  if (scope.type === "finding" && !scope.fingerprint.trim()) {
    throw new ClassificationValidationError("Classification scope fingerprint is required.");
  }

  switch (disposition) {
    case "false-positive":
    case "not-applicable":
      break;
    case "manual-review":
      break;
    case "accepted-risk":
      if (!owner?.trim()) {
        throw new ClassificationValidationError(
          "Accepted-risk classifications require an owner.",
        );
      }
      if (!expiresAt) {
        throw new ClassificationValidationError(
          "Accepted-risk classifications require an expiresAt date (YYYY-MM-DD).",
        );
      }
      parseCalendarDate(expiresAt);
      if (!options.allowPastExpiry) {
        assertFutureOrTodayCalendarDate(expiresAt, clock, "expiresAt");
      }
      break;
    case "third-party":
      if (!owner?.trim()) {
        throw new ClassificationValidationError(
          "Third-party classifications require an owner.",
        );
      }
      if (!expiresAt && !reviewAt) {
        throw new ClassificationValidationError(
          "Third-party classifications require expiresAt or reviewAt.",
        );
      }
      if (expiresAt) {
        parseCalendarDate(expiresAt);
      }
      if (reviewAt) {
        parseCalendarDate(reviewAt);
      }
      break;
    default:
      throw new ClassificationValidationError(
        `Unsupported disposition "${disposition as string}".`,
      );
  }
}

export function rejectResolvedDisposition(disposition: string): void {
  if (disposition === "resolved") {
    throw new ClassificationValidationError(
      "Cannot classify a current finding as resolved. Findings are resolved only when they no longer appear in an audit.",
    );
  }
}

export function dispositionLabel(disposition: FindingDisposition): string {
  switch (disposition) {
    case "false-positive":
      return "False positive";
    case "accepted-risk":
      return "Accepted risk";
    case "third-party":
      return "Third party";
    case "not-applicable":
      return "Not applicable";
    case "manual-review":
      return "Manual review";
  }
}
