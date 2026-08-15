import { describe, expect, it, vi } from "vitest";
import { applyPageReadiness, mergeRunReadiness } from "@a11yst/browser";
import { adapterFixture, webProject } from "../../helpers/adapters.js";

function createPageStub(overrides: {
  selectorMatches?: Record<string, boolean>;
  evaluateImpl?: (fn: (count: number) => unknown, count: number) => Promise<unknown>;
} = {}) {
  const selectorMatches = overrides.selectorMatches ?? {};
  const waitForSelector = vi.fn(async (selector: string) => {
    if (!selectorMatches[selector]) {
      throw new Error(`Selector not found: ${selector}`);
    }
  });
  const evaluate = vi.fn(async (fn: (count: number) => unknown, count: number) => {
    if (overrides.evaluateImpl) {
      return overrides.evaluateImpl(fn, count);
    }
    return fn(count);
  });

  return {
    page: { waitForSelector, evaluate },
    waitForSelector,
    evaluate,
  };
}

describe("mergeRunReadiness", () => {
  it("merges config overrides with adapter recommended selectors", () => {
    const project = webProject("react", {
      readiness: {
        waitUntil: "load",
        selector: "#app-shell",
        timeout: 5_000,
        settleFrames: 1,
      },
    });

    const merged = mergeRunReadiness(project, adapterFixture("html"), 30_000);

    expect(merged).toMatchObject({
      waitUntil: "load",
      selector: "#app-shell",
      timeout: 5_000,
      settleFrames: 1,
    });
    expect(merged.recommendedSelectors).toEqual(["#root", "[data-reactroot]", "body"]);
  });
});

describe("applyPageReadiness", () => {
  it("waits for an explicit selector and fails when it is missing", async () => {
    const stub = createPageStub();

    await expect(
      applyPageReadiness(stub.page as never, {
        readiness: {
          waitUntil: "domcontentloaded",
          selector: "#required-root",
          timeout: 100,
        },
        navigationTimeoutMs: 100,
      }),
    ).rejects.toThrow('Required readiness selector "#required-root"');

    expect(stub.waitForSelector).toHaveBeenCalledWith("#required-root", { timeout: 100 });
  });

  it("treats recommended selectors as non-blocking", async () => {
    const stub = createPageStub({
      selectorMatches: {
        body: true,
      },
    });

    const diagnostics = await applyPageReadiness(stub.page as never, {
      readiness: {
        waitUntil: "domcontentloaded",
        recommendedSelectors: ["#root", "[data-reactroot]", "body"],
      },
      navigationTimeoutMs: 30_000,
      run: {
        id: "run-id",
        projectName: "demo",
        platform: "web",
        framework: "react",
        profile: "default",
      },
    });

    expect(diagnostics).toEqual([]);
    expect(stub.waitForSelector).toHaveBeenCalledTimes(3);
    expect(stub.waitForSelector).toHaveBeenNthCalledWith(1, "#root", { timeout: 2_000 });
    expect(stub.waitForSelector).toHaveBeenNthCalledWith(2, "[data-reactroot]", { timeout: 2_000 });
    expect(stub.waitForSelector).toHaveBeenNthCalledWith(3, "body", { timeout: 2_000 });
  });

  it("records a diagnostic when no recommended selector matches", async () => {
    const stub = createPageStub();

    const diagnostics = await applyPageReadiness(stub.page as never, {
      readiness: {
        waitUntil: "domcontentloaded",
        recommendedSelectors: ["#root", "body"],
      },
      navigationTimeoutMs: 30_000,
      run: {
        id: "run-id",
        projectName: "demo",
        platform: "web",
        framework: "react",
        profile: "default",
      },
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "READINESS_SELECTOR_MISSING",
        severity: "warning",
        path: "runs.run-id",
      }),
    ]);
  });

  it("settles animation frames when configured", async () => {
    const evaluate = vi.fn(async () => undefined);
    const stub = {
      page: { waitForSelector: vi.fn(), evaluate },
    };

    await applyPageReadiness(stub.page as never, {
      readiness: {
        waitUntil: "domcontentloaded",
        settleFrames: 2,
      },
      navigationTimeoutMs: 30_000,
    });

    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), 2);
  });
});

describe("audit navigation waitUntil", () => {
  it("prefers project readiness waitUntil over adapter defaults", () => {
    const merged = mergeRunReadiness(webProject("html"), adapterFixture("html"), 30_000);
    expect(merged.waitUntil).toBe("domcontentloaded");
  });
});
