import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Finding } from "@a11yst/types";
import { createPresentationFixture } from "../../../fixtures/demo/presentation/sample-results.js";
import {
  createDemoSummary,
  renderDemoHeader,
  renderDemoSummary,
  renderDemoSummaryMarkdown,
  resolveDemoOutputRoot,
  resolveReportLocations,
} from "../../../../examples/demo/a11yst-shop/scripts/presentation/index.mjs";

const demoRoot = resolve("examples/demo/a11yst-shop");
const runDir = join(demoRoot, ".a11yst/results/runs/sample-run");

describe("demo presentation terminal renderer", () => {
  it("includes semantic text labels without ANSI control sequences", () => {
    const results = createPresentationFixture();
    const summary = createDemoSummary(results, 2);
    const locations = resolveReportLocations(demoRoot, runDir, results);
    const output = renderDemoHeader() + renderDemoSummary(summary, locations);

    expect(output).toContain("Known findings:");
    expect(output).toContain("New findings:");
    expect(output).toContain("Interactive findings:");
    expect(output).toContain("Mapped:");
    expect(output).toContain("Findings with recommendations:");
    expect(output).toContain("Current audit exit:");
    expect(output).toContain("Configured policy breach:");
    expect(output).toContain("HTML:");
    expect(output.includes("\u001b[")).toBe(false);
  });

  it("is deterministic for identical summary input", () => {
    const results = createPresentationFixture();
    const summary = createDemoSummary(results, 2);
    const locations = resolveReportLocations(demoRoot, runDir, results);
    const first = renderDemoSummary(summary, locations);
    const second = renderDemoSummary(summary, locations);
    expect(first).toBe(second);
  });
});

describe("demo presentation markdown renderer", () => {
  it("renders markdown tables and disclaimer without absolute paths", () => {
    const results = createPresentationFixture();
    const summary = createDemoSummary(results, 2);
    const locations = resolveReportLocations(demoRoot, runDir, results);
    const markdown = renderDemoSummaryMarkdown(summary, locations);

    expect(markdown).toContain("# a11yst demo summary");
    expect(markdown).toContain("| Known | 1 |");
    expect(markdown).toContain("Flow/checkpoint findings: 1");
    expect(markdown).toContain("Findings with recommendations: 2");
    expect(markdown).toContain("Configured policy breach: yes");
    expect(markdown).toContain(
      "Automated accessibility testing does not establish WCAG conformance",
    );
    expect(markdown).not.toMatch(/\/Users\//);
    expect(markdown).not.toMatch(/^file:/m);
  });

  it("is deterministic for identical summary input", () => {
    const results = createPresentationFixture();
    const summary = createDemoSummary(results, 2);
    const locations = resolveReportLocations(demoRoot, runDir, results);
    expect(renderDemoSummaryMarkdown(summary, locations)).toBe(
      renderDemoSummaryMarkdown(summary, locations),
    );
  });
});

describe("demo presentation paths", () => {
  it("returns report paths relative to the demo root", () => {
    const results = createPresentationFixture();
    const locations = resolveReportLocations(demoRoot, runDir, results);
    expect(locations.html).toBe(".a11yst/results/runs/sample-run/report/index.html");
    expect(locations.json).toBe(".a11yst/results/runs/sample-run/results.json");
    expect(locations.demoSummary).toBe(".a11yst/demo/demo-summary.md");
  });

  it("refuses cleanup outside the demo output directory", () => {
    expect(() => resolveDemoOutputRoot("/")).toThrow(/Demo failed/);
  });
});

describe("demo presentation security", () => {
  const secret = "ALLY_DEMO_SECRET_13F";
  const tempPath = "/tmp/a11yst-private-13f";
  const homePath = "/home/private-user";

  it("does not leak sensitive values in terminal or markdown output", () => {
    const base = createPresentationFixture().findings[0] as Finding;
    const results = createPresentationFixture({
      findings: [
        {
          ...base,
          description: secret,
        },
      ],
    });
    const summary = createDemoSummary(results, 2);
    const locations = resolveReportLocations(demoRoot, runDir, results);
    const terminal = renderDemoSummary(summary, locations);
    const markdown = renderDemoSummaryMarkdown(summary, locations);

    for (const output of [terminal, markdown]) {
      expect(output).not.toContain(secret);
      expect(output).not.toContain(tempPath);
      expect(output).not.toContain(homePath);
    }
  });
});
