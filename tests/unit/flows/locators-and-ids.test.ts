import { describe, expect, it } from "vitest";
import {
  buildFlowCheckpointRunId,
  buildFlowSessionId,
  LocatorError,
  serializeLocator,
  serializeLocatorDescription,
  validateLocatorConfig,
} from "@a11yst/flows";

describe("locator strategies", () => {
  it("accepts exactly one public locator strategy", () => {
    expect(() => validateLocatorConfig({ role: "button", name: "Open" })).not.toThrow();
    expect(() => validateLocatorConfig({ label: "Email" })).not.toThrow();
    expect(() => validateLocatorConfig({ text: "Continue" })).not.toThrow();
    expect(() => validateLocatorConfig({ placeholder: "Search" })).not.toThrow();
    expect(() => validateLocatorConfig({ testId: "submit" })).not.toThrow();
    expect(() => validateLocatorConfig({ css: "#submit" })).not.toThrow();
  });

  it("rejects empty or combined locator strategies", () => {
    expect(() => validateLocatorConfig({} as never)).toThrow(LocatorError);
    expect(() => validateLocatorConfig({ role: "button", css: "#x" } as never)).toThrow(
      /exactly one strategy/,
    );
  });

  it("serializes locator descriptions without inventing strategies", () => {
    expect(serializeLocator({ role: "button", name: "Open" })).toEqual({
      strategy: "role",
      description: 'role=button name="Open"',
    });
    expect(serializeLocatorDescription({ label: "Email" })).toBe('label="Email"');
    expect(serializeLocator({ testId: "cart" }).strategy).toBe("testId");
  });
});

describe("flow ids", () => {
  it("builds portable session and checkpoint run ids", () => {
    expect(
      buildFlowSessionId({
        projectName: "Web App",
        flowId: "open/cart",
        profile: "large-text",
        viewportName: "Desktop",
      }),
    ).toBe("flow::web-app::open-cart::large-text::desktop");

    expect(
      buildFlowCheckpointRunId({
        projectName: "Web App",
        flowId: "open/cart",
        checkpointId: "cart-drawer-open",
        profile: "default",
        viewportName: "desktop",
      }),
    ).toBe("flow::web-app::open-cart::cart-drawer-open::default::desktop");
  });
});
