import type {
  Diagnostic,
  FlowStepConfig,
  FlowStepResult,
  NormalizedFlowStep,
} from "@a11yst/types";
import type { Page } from "playwright";
import { captureObservation, diffObservation } from "./observation.js";
import {
  LocatorError,
  resolveLocator,
  serializeLocator,
  stableTarget,
  validateLocatorConfig,
} from "./locators.js";

export class FlowStepExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlowStepExecutionError";
  }
}

const REDACTED = "[REDACTED]";

function diagnostic(code: string, message: string): Diagnostic {
  return { code, severity: "error", message };
}

function resolveFillValue(step: Extract<FlowStepConfig, { action: "fill" }>): string {
  if (step.valueFromEnv) {
    const value = process.env[step.valueFromEnv];
    if (!value) {
      throw new FlowStepExecutionError(
        `Environment variable "${step.valueFromEnv}" is required for fill step but is not set.`,
      );
    }
    return value;
  }
  if (step.value === undefined) {
    throw new FlowStepExecutionError("Fill step requires value or valueFromEnv.");
  }
  return step.value;
}

function assertSameOrigin(url: URL, allowedOrigins: Set<string>): void {
  if (!allowedOrigins.has(url.origin)) {
    throw new FlowStepExecutionError(
      `Navigation to ${url.href} is outside allowed origins: ${[...allowedOrigins].join(", ")}.`,
    );
  }
}

export interface ExecuteStepOptions {
  page: Page;
  step: NormalizedFlowStep;
  baseOrigin: string;
  allowedOrigins: string[];
  stepTimeout: number;
  navigationTimeout: number;
}

export async function executeFlowStep(
  options: ExecuteStepOptions,
): Promise<Omit<FlowStepResult, "index" | "startedAt" | "durationMs">> {
  const { page, step, baseOrigin, allowedOrigins, stepTimeout, navigationTimeout } = options;
  const allowed = new Set([baseOrigin, ...allowedOrigins]);
  const before = await captureObservation(page);
  const diagnostics: Diagnostic[] = [];

  try {
    switch (step.action) {
      case "goto": {
        const url = new URL(step.path, baseOrigin);
        assertSameOrigin(url, allowed);
        await page.goto(url.toString(), {
          waitUntil: "domcontentloaded",
          timeout: navigationTimeout,
        });
        break;
      }
      case "click": {
        validateLocatorConfig(step.locator);
        const locator = resolveLocator(page, step.locator);
        await locator.click({ timeout: stepTimeout });
        break;
      }
      case "fill": {
        validateLocatorConfig(step.locator);
        const locator = resolveLocator(page, step.locator);
        const value = resolveFillValue(step);
        await locator.fill(value, { timeout: stepTimeout });
        break;
      }
      case "press": {
        if (step.locator) {
          validateLocatorConfig(step.locator);
          await resolveLocator(page, step.locator).press(step.key, { timeout: stepTimeout });
        } else {
          await page.keyboard.press(step.key);
        }
        break;
      }
      case "check": {
        validateLocatorConfig(step.locator);
        await resolveLocator(page, step.locator).check({ timeout: stepTimeout });
        break;
      }
      case "uncheck": {
        validateLocatorConfig(step.locator);
        await resolveLocator(page, step.locator).uncheck({ timeout: stepTimeout });
        break;
      }
      case "select": {
        validateLocatorConfig(step.locator);
        const locator = resolveLocator(page, step.locator);
        if (step.label) {
          await locator.selectOption({ label: step.label }, { timeout: stepTimeout });
        } else if (step.value) {
          await locator.selectOption(step.value, { timeout: stepTimeout });
        } else {
          throw new FlowStepExecutionError("Select step requires value or label.");
        }
        break;
      }
      case "wait-for": {
        validateLocatorConfig(step.locator);
        const locator = resolveLocator(page, step.locator);
        const state = step.state ?? "visible";
        if (state === "enabled") {
          await locator.waitFor({ state: "visible", timeout: stepTimeout });
          if (await locator.isDisabled()) {
            throw new FlowStepExecutionError("Element remained disabled.");
          }
        } else if (state === "disabled") {
          await locator.waitFor({ state: "attached", timeout: stepTimeout });
          if (!(await locator.isDisabled())) {
            throw new FlowStepExecutionError("Element was not disabled.");
          }
        } else {
          await locator.waitFor({ state, timeout: stepTimeout });
        }
        break;
      }
      case "wait-for-url": {
        const expected = step.url
          ? new URL(step.url)
          : new URL(step.path ?? "/", baseOrigin);
        assertSameOrigin(expected, allowed);
        await page.waitForURL(expected.toString(), { timeout: stepTimeout });
        break;
      }
      case "expect-visible": {
        validateLocatorConfig(step.locator);
        const locator = resolveLocator(page, step.locator);
        await locator.waitFor({ state: "visible", timeout: stepTimeout });
        break;
      }
      case "expect-hidden": {
        validateLocatorConfig(step.locator);
        await resolveLocator(page, step.locator).waitFor({ state: "hidden", timeout: stepTimeout });
        break;
      }
      case "expect-text": {
        validateLocatorConfig(step.locator);
        const locator = resolveLocator(page, step.locator);
        await locator.waitFor({ state: "visible", timeout: stepTimeout });
        const text = await locator.innerText();
        const matches = step.exact ? text === step.text : text.includes(step.text);
        if (!matches) {
          throw new FlowStepExecutionError(
            `Expected text "${step.text}" but found "${text.slice(0, 120)}".`,
          );
        }
        break;
      }
      case "expect-url": {
        const current = new URL(page.url());
        const expectedPath = step.path ?? new URL(step.url ?? baseOrigin).pathname;
        if (current.pathname !== expectedPath) {
          throw new FlowStepExecutionError(
            `Expected URL path "${expectedPath}" but found "${current.pathname}".`,
          );
        }
        break;
      }
      case "checkpoint":
        break;
      default:
        throw new FlowStepExecutionError(`Unknown flow action: ${(step as FlowStepConfig).action}`);
    }
  } catch (error) {
    const message =
      error instanceof LocatorError || error instanceof FlowStepExecutionError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return {
      action: step.action,
      status: "failed",
      diagnostics: [diagnostic("FLOW_STEP_FAILED", message)],
      failureReason: message,
      observedChanges: diffObservation(before, await captureObservation(page)),
      ...(step.action !== "checkpoint" && "locator" in step && step.locator
        ? { locator: serializeLocator(step.locator) }
        : {}),
      ...(step.action === "checkpoint"
        ? { checkpointId: step.id, checkpointName: step.name ?? step.id }
        : {}),
    };
  }

  const after = await captureObservation(page);
  let target: string[] | undefined;
  if ("locator" in step && step.locator) {
    try {
      target = await stableTarget(resolveLocator(page, step.locator));
    } catch {
      target = undefined;
    }
  }

  return {
    action: step.action,
    status: "completed",
    diagnostics,
    observedChanges: diffObservation(before, after),
    ...(step.action !== "checkpoint" && "locator" in step && step.locator
      ? { locator: serializeLocator(step.locator) }
      : {}),
    ...(target?.length ? { target } : {}),
    ...(step.action === "checkpoint"
      ? { checkpointId: step.id, checkpointName: step.name ?? step.id }
      : {}),
    ...(step.action === "fill" && "sensitive" in step && step.sensitive
      ? { failureReason: undefined }
      : {}),
  };
}

export function maskStepForTrace(step: NormalizedFlowStep): NormalizedFlowStep {
  if (step.action !== "fill" || !step.sensitive) return step;
  return { ...step, value: REDACTED, valueFromEnv: step.valueFromEnv ? REDACTED : undefined };
}

export { REDACTED };
