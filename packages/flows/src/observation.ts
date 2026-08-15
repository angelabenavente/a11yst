import type { ActionObservation, ElementSummary } from "@a11yst/types";
import type { Page } from "playwright";

const MAX_ELEMENTS = 8;
const MAX_TEXT = 120;

async function summarizeElement(page: Page): Promise<ElementSummary | undefined> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) {
      return undefined;
    }
    const role = active.getAttribute("role") ?? active.tagName.toLowerCase();
    const accessibleName =
      active.getAttribute("aria-label") ??
      active.textContent?.trim().slice(0, 120) ??
      undefined;
    const rect = active.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0;
    const target = [
      active.tagName.toLowerCase(),
      active.id ? `#${active.id}` : "",
    ].filter(Boolean);
    return {
      target,
      role,
      accessibleName,
      visible,
    };
  });
}

async function collectDialogs(page: Page): Promise<ElementSummary[]> {
  return page.evaluate((limits) => {
    const nodes = Array.from(
      document.querySelectorAll('[role="dialog"], dialog[open], [aria-modal="true"]'),
    );
    return nodes.slice(0, limits.max).map((element) => {
      const role = element.getAttribute("role") ?? element.tagName.toLowerCase();
      const accessibleName =
        element.getAttribute("aria-label") ??
        element.getAttribute("aria-labelledby") ??
        element.textContent?.trim().slice(0, limits.text) ??
        undefined;
      const rect = element.getBoundingClientRect();
      return {
        target: [element.tagName.toLowerCase()],
        role,
        accessibleName,
        visible: rect.width > 0 && rect.height > 0,
      };
    });
  }, { max: MAX_ELEMENTS, text: MAX_TEXT });
}

async function collectErrors(page: Page): Promise<ElementSummary[]> {
  return page.evaluate((limits) => {
    const nodes = Array.from(
      document.querySelectorAll('[role="alert"], [aria-live="assertive"], .error, [data-error]'),
    );
    return nodes.slice(0, limits.max).map((element) => {
      const role = element.getAttribute("role") ?? element.tagName.toLowerCase();
      const accessibleName = element.textContent?.trim().slice(0, limits.text) ?? undefined;
      const rect = element.getBoundingClientRect();
      return {
        target: [element.tagName.toLowerCase()],
        role,
        accessibleName,
        visible: rect.width > 0 && rect.height > 0,
      };
    });
  }, { max: MAX_ELEMENTS, text: MAX_TEXT });
}

export async function captureObservation(page: Page): Promise<{
  url: string;
  activeElement?: ElementSummary;
  visibleDialogs: ElementSummary[];
  errorMessages: ElementSummary[];
}> {
  const [activeElement, visibleDialogs, errorMessages] = await Promise.all([
    summarizeElement(page),
    collectDialogs(page),
    collectErrors(page),
  ]);
  return {
    url: page.url(),
    ...(activeElement !== undefined ? { activeElement } : {}),
    visibleDialogs,
    errorMessages,
  };
}

export function diffObservation(
  before: Awaited<ReturnType<typeof captureObservation>>,
  after: Awaited<ReturnType<typeof captureObservation>>,
): ActionObservation {
  return {
    urlBefore: before.url,
    urlAfter: after.url,
    ...(before.activeElement ? { activeElementBefore: before.activeElement } : {}),
    ...(after.activeElement ? { activeElementAfter: after.activeElement } : {}),
    visibleDialogsBefore: before.visibleDialogs,
    visibleDialogsAfter: after.visibleDialogs,
    errorMessagesBefore: before.errorMessages,
    errorMessagesAfter: after.errorMessages,
  };
}
