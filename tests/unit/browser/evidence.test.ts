import { describe, expect, it, vi } from "vitest";
import {
  buildContextOptions,
  capturePageEvidence,
  sanitizeHtmlSnippet,
  type EvidenceSink,
} from "@a11yst/browser";
import type { Finding, PlannedRun } from "@a11yst/types";

const run: PlannedRun = {
  id: "website::home::default::phone",
  projectName: "website",
  platform: "web",
  framework: "react",
  profile: "default",
  routeId: "home",
  routeName: "Home",
  route: { id: "root", name: "Home", path: "/" },
  viewport: {
    name: "phone",
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    orientation: "portrait",
  },
};

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "button-name",
    fingerprint: "fingerprint",
    source: "axe",
    ruleId: "button-name",
    title: "Button name",
    severity: "high",
    projectName: "website",
    profile: "default",
    target: ["#submit"],
    html: "<button id=\"submit\"></button>",
    standards: [],
    ...overrides,
  };
}

describe("buildContextOptions", () => {
  it("applies normalized scale, mobile, touch, orientation, and isolation settings", () => {
    expect(buildContextOptions(run.viewport)).toMatchObject({
      viewport: { width: 390, height: 844 },
      screen: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: "en-US",
      timezoneId: "UTC",
      serviceWorkers: "block",
    });
  });

  it("infers landscape orientation through consistent screen dimensions", () => {
    const options = buildContextOptions({ name: "wide", width: 1024, height: 600 });
    expect(options.viewport).toEqual({ width: 1024, height: 600 });
    expect(options.screen).toEqual({ width: 1024, height: 600 });
  });

  it("orients emulated screen dimensions while preserving the configured viewport", () => {
    const options = buildContextOptions({
      name: "rotated",
      width: 844,
      height: 390,
      orientation: "portrait",
    });
    expect(options.viewport).toEqual({ width: 844, height: 390 });
    expect(options.screen).toEqual({ width: 390, height: 844 });
  });
});

describe("sanitizeHtmlSnippet", () => {
  it("removes input values and redacts textarea/select contents", () => {
    const html =
      '<div><input name="token" value="secret"><textarea>private note</textarea>' +
      '<select value="internal"><option selected value="x">Secret choice</option></select></div>';
    const sanitized = sanitizeHtmlSnippet(html);
    expect(sanitized).not.toContain("secret");
    expect(sanitized).not.toContain("private note");
    expect(sanitized).not.toContain("Secret choice");
    expect(sanitized).not.toMatch(/\svalue\s*=/i);
    expect(sanitized).toContain("[REDACTED]");
  });
});

describe("capturePageEvidence", () => {
  it("does not call the sink when screenshots are disabled", async () => {
    const sink: EvidenceSink = {
      writeRunScreenshot: vi.fn(),
      writeFindingScreenshot: vi.fn(),
    };
    const item = finding();
    const result = await capturePageEvidence({
      page: {} as never,
      run,
      findings: [item],
      options: { screenshots: false, fullPage: false, sink },
    });

    expect(sink.writeRunScreenshot).not.toHaveBeenCalled();
    expect(sink.writeFindingScreenshot).not.toHaveBeenCalled();
    expect(result.diagnostics).toEqual([]);
    expect(item.evidence).toEqual({ htmlSnippet: item.html });
  });

  it("turns run screenshot failures into non-blocking diagnostics", async () => {
    const item = finding({ target: [] });
    const page = {
      screenshot: vi.fn().mockRejectedValue(new Error("renderer unavailable")),
    };
    const sink: EvidenceSink = {
      writeRunScreenshot: vi.fn(),
      writeFindingScreenshot: vi.fn(),
    };

    const result = await capturePageEvidence({
      page: page as never,
      run,
      findings: [item],
      options: { screenshots: true, fullPage: false, sink },
    });

    expect(result.screenshot).toBeUndefined();
    expect(result.diagnostics.map((item) => item.code)).toContain("RUN_SCREENSHOT_FAILED");
    expect(item.evidence?.screenshot).toBeUndefined();
    expect(item.evidence?.pageScreenshot).toBeUndefined();
  });

  it("limits excessively tall full-page captures to the viewport", async () => {
    const page = {
      evaluate: vi.fn().mockResolvedValue(12_001),
      screenshot: vi.fn().mockResolvedValue(Buffer.from("page")),
    };
    const sink: EvidenceSink = {
      writeRunScreenshot: vi.fn().mockResolvedValue("evidence/run.png"),
      writeFindingScreenshot: vi.fn(),
    };

    const result = await capturePageEvidence({
      page: page as never,
      run,
      findings: [],
      options: { screenshots: true, fullPage: true, sink },
    });

    expect(page.screenshot).toHaveBeenCalledWith({ animations: "disabled", fullPage: false });
    expect(result.screenshot).toBe("evidence/run.png");
    expect(result.diagnostics.map((item) => item.code)).toContain(
      "FULL_PAGE_SCREENSHOT_LIMITED",
    );
  });

  it("writes one deterministic target screenshot and attaches serializable evidence", async () => {
    const locator = {
      first: vi.fn(),
      scrollIntoViewIfNeeded: vi.fn(),
      boundingBox: vi.fn().mockResolvedValue({ x: 4, y: 8, width: 20, height: 30 }),
      screenshot: vi.fn().mockResolvedValue(Buffer.from("element")),
    };
    locator.first.mockReturnValue(locator);
    const page = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from("page")),
      locator: vi.fn().mockReturnValue(locator),
      evaluate: vi.fn().mockResolvedValue({ x: 2, y: 3 }),
    };
    const sink: EvidenceSink = {
      writeRunScreenshot: vi.fn().mockResolvedValue("evidence/page.png"),
      writeFindingScreenshot: vi.fn().mockResolvedValue("evidence/finding.png"),
    };
    const item = finding();

    const result = await capturePageEvidence({
      page: page as never,
      run,
      findings: [item],
      options: { screenshots: true, fullPage: false, sink },
    });

    expect(result.diagnostics).toEqual([]);
    expect(sink.writeFindingScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({ run, finding: item, targetIndex: 0 }),
    );
    expect(item.evidence).toEqual({
      screenshot: "evidence/finding.png",
      pageScreenshot: "evidence/page.png",
      boundingBox: { x: 6, y: 11, width: 20, height: 30 },
      htmlSnippet: item.html,
    });
  });
});
