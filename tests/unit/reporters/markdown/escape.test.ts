import { describe, expect, it } from "vitest";
import {
  encodeMarkdownLinkTarget,
  escapeMarkdownLinkLabel,
  escapeMarkdownTableCell,
  escapeMarkdownText,
} from "@a11yst/reporters";

describe("escapeMarkdownText", () => {
  it("escapes markdown and HTML special characters", () => {
    expect(escapeMarkdownText('`code` *bold* _italic_ #tag [link] <script>')).toBe(
      "\\`code\\` \\*bold\\* \\_italic\\_ \\#tag \\[link\\] &lt;script&gt;",
    );
  });

  it("escapes backslashes", () => {
    expect(escapeMarkdownText("path\\to\\file")).toBe("path\\\\to\\\\file");
  });
});

describe("escapeMarkdownTableCell", () => {
  it("escapes pipes and collapses whitespace", () => {
    expect(escapeMarkdownTableCell("  a | b \n c  ")).toBe("a \\| b c");
  });
});

describe("escapeMarkdownLinkLabel", () => {
  it("escapes brackets and backslashes in link labels", () => {
    expect(escapeMarkdownLinkLabel("[unsafe]\\label")).toBe("\\[unsafe\\]\\\\label");
  });
});

describe("encodeMarkdownLinkTarget", () => {
  it("percent-encodes unsafe URL characters", () => {
    expect(encodeMarkdownLinkTarget("reports/my report (v2).md#section?x=1")).toBe(
      "reports/my%20report%20%28v2%29.md%23section%3Fx=1",
    );
  });
});
