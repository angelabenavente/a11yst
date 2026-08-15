import { describe, expect, it } from "vitest";
import {
  formatSafeReportSourceLocation,
  sanitizeSourceUriForReport,
} from "../../../packages/reporters/src/finding-source-report.js";

describe("sanitizeSourceUriForReport", () => {
  it("preserves relative project paths", () => {
    expect(sanitizeSourceUriForReport("src/components/SocialLinks.jsx")).toBe(
      "src/components/SocialLinks.jsx",
    );
  });

  it("strips absolute paths to a short relative tail", () => {
    expect(
      sanitizeSourceUriForReport("/Users/angela/project/src/components/SocialLinks.jsx"),
    ).toBe("components/SocialLinks.jsx");
  });

  it("formats safe locations without absolute prefixes", () => {
    const formatted = formatSafeReportSourceLocation({
      uri: "/Users/angela/project/src/LanguageSelector.jsx",
      region: { start: { line: 24, column: 7 } },
    });
    expect(formatted).toBe("src/LanguageSelector.jsx:24:7");
    expect(formatted).not.toContain("/Users/angela");
  });
});
