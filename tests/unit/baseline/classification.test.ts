import { describe, expect, it } from "vitest";
import {
  ClassificationValidationError,
  dispositionLabel,
  rejectResolvedDisposition,
  validateClassification,
} from "@a11yst/baseline";
import {
  classification,
  fixedClock,
  FIXED_CALENDAR,
  FUTURE_CALENDAR,
  PAST_CALENDAR,
} from "./fixtures.js";

describe("validateClassification", () => {
  it("accepts false-positive without owner or expiry", () => {
    expect(() =>
      validateClassification(
        classification({ disposition: "false-positive" }),
        { clock: fixedClock() },
      ),
    ).not.toThrow();
  });

  it("accepts not-applicable without owner or expiry", () => {
    expect(() =>
      validateClassification(
        classification({ disposition: "not-applicable", reason: "Out of scope." }),
        { clock: fixedClock() },
      ),
    ).not.toThrow();
  });

  it("accepts manual-review without owner or expiry", () => {
    expect(() =>
      validateClassification(
        classification({ disposition: "manual-review", reason: "Needs design review." }),
        { clock: fixedClock() },
      ),
    ).not.toThrow();
  });

  it("requires reason for every disposition", () => {
    expect(() =>
      validateClassification(classification({ reason: "   " }), { clock: fixedClock() }),
    ).toThrow(ClassificationValidationError);
    expect(() =>
      validateClassification(classification({ reason: "   " }), { clock: fixedClock() }),
    ).toThrow(/reason is required/i);
  });

  it("requires scope fingerprint for finding scope", () => {
    expect(() =>
      validateClassification(
        classification({
          scope: { type: "finding", fingerprint: "  " },
        }),
        { clock: fixedClock() },
      ),
    ).toThrow(/scope fingerprint is required/i);
  });

  it("requires owner and expiresAt for accepted-risk", () => {
    expect(() =>
      validateClassification(
        classification({
          disposition: "accepted-risk",
          owner: undefined,
          expiresAt: FUTURE_CALENDAR,
        }),
        { clock: fixedClock() },
      ),
    ).toThrow(/require an owner/i);

    expect(() =>
      validateClassification(
        classification({
          disposition: "accepted-risk",
          owner: "platform-team",
          expiresAt: undefined,
        }),
        { clock: fixedClock() },
      ),
    ).toThrow(/require an expiresAt/i);
  });

  it("rejects past expiresAt for accepted-risk using injectable clock", () => {
    expect(() =>
      validateClassification(
        classification({
          disposition: "accepted-risk",
          owner: "platform-team",
          expiresAt: PAST_CALENDAR,
        }),
        { clock: fixedClock(`${FIXED_CALENDAR}T12:00:00.000Z`) },
      ),
    ).toThrow(/must be today or in the future/i);
  });

  it("allows past expiresAt when allowPastExpiry is set", () => {
    expect(() =>
      validateClassification(
        classification({
          disposition: "accepted-risk",
          owner: "platform-team",
          expiresAt: PAST_CALENDAR,
        }),
        { clock: fixedClock(), allowPastExpiry: true },
      ),
    ).not.toThrow();
  });

  it("requires owner and expiresAt or reviewAt for third-party", () => {
    expect(() =>
      validateClassification(
        classification({
          disposition: "third-party",
          owner: undefined,
          expiresAt: FUTURE_CALENDAR,
        }),
        { clock: fixedClock() },
      ),
    ).toThrow(/Third-party classifications require an owner/i);

    expect(() =>
      validateClassification(
        classification({
          disposition: "third-party",
          owner: "vendor-team",
          expiresAt: undefined,
          reviewAt: undefined,
        }),
        { clock: fixedClock() },
      ),
    ).toThrow(/require expiresAt or reviewAt/i);
  });

  it("accepts third-party with reviewAt only", () => {
    expect(() =>
      validateClassification(
        classification({
          disposition: "third-party",
          owner: "vendor-team",
          reviewAt: FUTURE_CALENDAR,
          expiresAt: undefined,
        }),
        { clock: fixedClock() },
      ),
    ).not.toThrow();
  });

  it("rejects unsupported dispositions", () => {
    expect(() =>
      validateClassification(
        classification({ disposition: "resolved" as "false-positive" }),
        { clock: fixedClock() },
      ),
    ).toThrow(/Unsupported disposition "resolved"/);
  });
});

describe("rejectResolvedDisposition", () => {
  it("rejects resolved disposition", () => {
    expect(() => rejectResolvedDisposition("resolved")).toThrow(ClassificationValidationError);
    expect(() => rejectResolvedDisposition("resolved")).toThrow(
      /Cannot classify a current finding as resolved/,
    );
  });

  it("allows other dispositions", () => {
    expect(() => rejectResolvedDisposition("false-positive")).not.toThrow();
  });
});

describe("dispositionLabel", () => {
  it("returns human-readable labels for all dispositions", () => {
    expect(dispositionLabel("false-positive")).toBe("False positive");
    expect(dispositionLabel("accepted-risk")).toBe("Accepted risk");
    expect(dispositionLabel("third-party")).toBe("Third party");
    expect(dispositionLabel("not-applicable")).toBe("Not applicable");
    expect(dispositionLabel("manual-review")).toBe("Manual review");
  });
});
