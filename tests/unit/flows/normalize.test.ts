import { describe, expect, it } from "vitest";
import {
  collectRequiredEnvVars,
  extractCheckpointIds,
  FlowConfigError,
  maskStepForTrace,
  normalizeFlow,
  normalizeProjectFlows,
} from "@a11yst/flows";
import type { FlowConfig, FlowStepAction, NormalizedViewport } from "@a11yst/types";

const DOCUMENTED_FLOW_ACTIONS: FlowStepAction[] = [
  "goto",
  "click",
  "fill",
  "press",
  "check",
  "uncheck",
  "select",
  "wait-for",
  "wait-for-url",
  "expect-visible",
  "expect-hidden",
  "expect-text",
  "expect-url",
  "checkpoint",
];

const desktop: NormalizedViewport = {
  name: "desktop",
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
  orientation: "landscape",
};

const baseOptions = {
  projectName: "site",
  projectProfileOptions: [{ id: "default" as const }],
  projectViewports: [desktop],
  projectRootDir: "/tmp/site",
  baseOrigin: "http://127.0.0.1:3000",
};

function validFlow(overrides: Partial<FlowConfig> = {}): FlowConfig {
  return {
    id: "open-dialog",
    name: "Open dialog",
    start: "/",
    steps: [
      { action: "click", locator: { role: "button", name: "Open" } },
      { action: "checkpoint", id: "dialog-open", name: "Dialog visible" },
    ],
    ...overrides,
  };
}

describe("documented flow actions", () => {
  it("keeps the public action set unchanged", () => {
    expect(DOCUMENTED_FLOW_ACTIONS).toEqual([
      "goto",
      "click",
      "fill",
      "press",
      "check",
      "uncheck",
      "select",
      "wait-for",
      "wait-for-url",
      "expect-visible",
      "expect-hidden",
      "expect-text",
      "expect-url",
      "checkpoint",
    ]);
  });
});

describe("extractCheckpointIds / collectRequiredEnvVars", () => {
  it("collects checkpoint ids in step order", () => {
    expect(
      extractCheckpointIds([
        { action: "click", locator: { role: "button", name: "Open" } },
        { action: "checkpoint", id: "open" },
        { action: "press", key: "Escape" },
        { action: "checkpoint", id: "closed" },
      ]),
    ).toEqual(["open", "closed"]);
  });

  it("collects fill valueFromEnv names in sorted order", () => {
    expect(
      collectRequiredEnvVars([
        { action: "fill", locator: { label: "Token" }, valueFromEnv: "A11YST_TOKEN" },
        { action: "fill", locator: { label: "Name" }, value: "Ada" },
        { action: "fill", locator: { label: "Card" }, valueFromEnv: "A11YST_CARD", sensitive: true },
      ]),
    ).toEqual(["A11YST_CARD", "A11YST_TOKEN"]);
  });
});

describe("normalizeFlow", () => {
  it("normalizes a valid flow with checkpoint metadata and defaults", () => {
    const flow = normalizeFlow(validFlow(), baseOptions);
    expect(flow.id).toBe("open-dialog");
    expect(flow.name).toBe("Open dialog");
    expect(flow.start).toBe("/");
    expect(flow.checkpointIds).toEqual(["dialog-open"]);
    expect(flow.profiles).toEqual(["default"]);
    expect(flow.viewportNames).toEqual(["desktop"]);
    expect(flow.stepTimeout).toBe(10_000);
    expect(flow.navigationTimeout).toBe(30_000);
    expect(flow.steps[0]).toMatchObject({ action: "click", index: 0 });
    expect(flow.steps[1]).toMatchObject({ action: "checkpoint", id: "dialog-open", index: 1 });
  });

  it("rejects missing id, start, steps, and checkpoints", () => {
    expect(() => normalizeFlow(validFlow({ id: "  " }), baseOptions)).toThrow(FlowConfigError);
    expect(() => normalizeFlow(validFlow({ start: "" }), baseOptions)).toThrow(/start path/);
    expect(() => normalizeFlow(validFlow({ steps: [] }), baseOptions)).toThrow(/at least one step/);
    expect(() =>
      normalizeFlow(
        validFlow({
          steps: [{ action: "click", locator: { role: "button", name: "Open" } }],
        }),
        baseOptions,
      ),
    ).toThrow(/at least one explicit checkpoint/);
  });

  it("rejects duplicate checkpoint ids and unknown viewports", () => {
    expect(() =>
      normalizeFlow(
        validFlow({
          steps: [
            { action: "checkpoint", id: "open" },
            { action: "checkpoint", id: "open" },
          ],
        }),
        baseOptions,
      ),
    ).toThrow(/duplicate checkpoint ids/);
    expect(() => normalizeFlow(validFlow({ viewports: ["tablet"] }), baseOptions)).toThrow(
      /unknown viewport/,
    );
  });

  it("rejects a start path that leaves the project origin", () => {
    expect(() => normalizeFlow(validFlow({ start: "https://example.com/" }), baseOptions)).toThrow(
      /outside project origin/,
    );
  });
});

describe("normalizeProjectFlows", () => {
  it("sorts flows by id and rejects duplicates", () => {
    const flows = normalizeProjectFlows(
      [validFlow({ id: "zeta" }), validFlow({ id: "alpha" })],
      baseOptions,
    );
    expect(flows.map((flow) => flow.id)).toEqual(["alpha", "zeta"]);
    expect(() =>
      normalizeProjectFlows([validFlow({ id: "same" }), validFlow({ id: "same" })], baseOptions),
    ).toThrow(/Duplicate flow id/);
  });
});

describe("maskStepForTrace", () => {
  it("redacts sensitive fill values and env var names", () => {
    const masked = maskStepForTrace({
      action: "fill",
      index: 0,
      locator: { label: "Card" },
      value: "4242424242424242",
      valueFromEnv: "A11YST_CARD",
      sensitive: true,
    });
    expect(masked).toMatchObject({
      action: "fill",
      value: "[REDACTED]",
      valueFromEnv: "[REDACTED]",
    });
  });

  it("leaves non-sensitive steps unchanged", () => {
    const step = {
      action: "click" as const,
      index: 0,
      locator: { role: "button", name: "Open" },
    };
    expect(maskStepForTrace(step)).toEqual(step);
  });
});
