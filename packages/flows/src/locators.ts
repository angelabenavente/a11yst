import type { LocatorConfig, SerializedLocator } from "@a11yst/types";
import type { Locator, Page } from "playwright";

export class LocatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocatorError";
  }
}

export function validateLocatorConfig(locator: LocatorConfig): void {
  const keys = Object.keys(locator);
  const strategies = [
    "role",
    "label",
    "text",
    "placeholder",
    "testId",
    "css",
  ] as const;
  const matched = strategies.filter((key) => key in locator);
  if (matched.length !== 1) {
    throw new LocatorError(
      `Locator must use exactly one strategy (role, label, text, placeholder, testId, or css). Found: ${keys.join(", ")}.`,
    );
  }
}

export function serializeLocator(locator: LocatorConfig): SerializedLocator {
  if ("role" in locator) {
    const name = locator.name ? ` name="${locator.name}"` : "";
    return {
      strategy: "role",
      description: `role=${locator.role}${name}`,
    };
  }
  if ("label" in locator) {
    return { strategy: "label", description: `label="${locator.label}"` };
  }
  if ("text" in locator) {
    return { strategy: "text", description: `text="${locator.text}"` };
  }
  if ("placeholder" in locator) {
    return {
      strategy: "placeholder",
      description: `placeholder="${locator.placeholder}"`,
    };
  }
  if ("testId" in locator) {
    return { strategy: "testId", description: `testId="${locator.testId}"` };
  }
  return { strategy: "css", description: `css="${locator.css}"` };
}

export function serializeLocatorDescription(locator: LocatorConfig): string {
  return serializeLocator(locator).description;
}

export function resolveLocator(page: Page, locator: LocatorConfig): Locator {
  validateLocatorConfig(locator);
  if ("role" in locator) {
    return page.getByRole(locator.role as Parameters<Page["getByRole"]>[0], {
      ...(locator.name !== undefined ? { name: locator.name } : {}),
      ...(locator.exact !== undefined ? { exact: locator.exact } : {}),
    });
  }
  if ("label" in locator) {
    return page.getByLabel(locator.label, {
      ...(locator.exact !== undefined ? { exact: locator.exact } : {}),
    });
  }
  if ("text" in locator) {
    return page.getByText(locator.text, {
      ...(locator.exact !== undefined ? { exact: locator.exact } : {}),
    });
  }
  if ("placeholder" in locator) {
    return page.getByPlaceholder(locator.placeholder, {
      ...(locator.exact !== undefined ? { exact: locator.exact } : {}),
    });
  }
  if ("testId" in locator) {
    return page.getByTestId(locator.testId);
  }
  return page.locator(locator.css);
}

export async function stableTarget(locator: Locator): Promise<string[]> {
  try {
    const count = await locator.count();
    if (count === 0) return [];
    const handle = await locator.first().elementHandle();
    if (!handle) return [];
    return await handle.evaluate((element) => {
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        const tag = current.tagName.toLowerCase();
        const id = current.id ? `#${current.id}` : "";
        const testId = current.getAttribute("data-testid");
        const testPart = testId ? `[data-testid="${testId}"]` : "";
        parts.unshift(`${tag}${id}${testPart}`);
        current = current.parentElement;
        if (parts.length >= 4) break;
      }
      return parts.slice(-3);
    });
  } catch {
    return [];
  }
}
