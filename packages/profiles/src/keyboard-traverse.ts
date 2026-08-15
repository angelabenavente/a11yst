import type { FocusStep } from "@a11yst/types";
import type { InteractiveInventoryItem, KeyboardTraversalResult } from "@a11yst/rules";
import type { Page } from "playwright";
import { readActiveFocusStep } from "./dom.js";

export async function traverseKeyboard(
  page: Page,
  inventory: InteractiveInventoryItem[],
  options: { maxTabStops: number; viewportWidth: number; viewportHeight: number },
): Promise<KeyboardTraversalResult> {
  const forwardSteps: FocusStep[] = [];
  const seenKeys = new Set<string>();
  let stopReason = "completed";

  await page.locator("body").focus();

  const initial = await readActiveFocusStep(page, 0, "forward", options.viewportWidth, options.viewportHeight);
  forwardSteps.push(initial);

  for (let index = 1; index <= options.maxTabStops; index += 1) {
    await page.keyboard.press("Tab");
    const step = await readActiveFocusStep(page, index, "forward", options.viewportWidth, options.viewportHeight);
    forwardSteps.push(step);
    const key = (step.target ?? []).join("|") || "none";
    if (!step.target || step.target.length === 0 || (!step.visible && key === "none")) {
      stopReason = "focus-lost";
      break;
    }
    if (seenKeys.has(key) && index > 2) {
      stopReason = "cycle-detected";
      break;
    }
    seenKeys.add(key);
    if (index === options.maxTabStops) {
      stopReason = "limit-reached";
    }
  }

  const backwardSteps: FocusStep[] = [];
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press("Shift+Tab");
    backwardSteps.push(
      await readActiveFocusStep(page, index, "backward", options.viewportWidth, options.viewportHeight),
    );
  }

  const positiveTabIndexes = inventory.filter(
    (item) => typeof item.tabindex === "number" && item.tabindex > 0,
  );

  return {
    forwardSteps,
    backwardSteps,
    stopReason,
    positiveTabIndexes,
    inventory,
  };
}
