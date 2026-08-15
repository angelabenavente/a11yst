import type { FocusStep, MotionRecord } from "@a11yst/types";
import type { InteractiveInventoryItem } from "@a11yst/rules";
import type { LayoutElementSnapshot } from "@a11yst/rules";
import type { Page } from "playwright";

export async function collectInteractiveInventory(page: Page): Promise<InteractiveInventoryItem[]> {
  return page.evaluate(() => {
    const items: InteractiveInventoryItem[] = [];
    const elements = Array.from(
      document.querySelectorAll("a,button,input,select,textarea,[tabindex],[role='button'],[role='link']"),
    );
    for (const element of elements) {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      const tag = htmlElement.tagName.toLowerCase();
      const role = htmlElement.getAttribute("role") ?? undefined;
      const tabindexAttr = htmlElement.getAttribute("tabindex");
      const tabindex = tabindexAttr === null ? undefined : Number(tabindexAttr);
      const visible =
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0;
      items.push({
        target: [buildSelector(htmlElement)],
        tag,
        role,
        accessibleName: htmlElement.getAttribute("aria-label") ?? htmlElement.textContent?.trim()?.slice(0, 120),
        tabindex: Number.isFinite(tabindex) ? tabindex : undefined,
        disabled:
          (htmlElement as HTMLInputElement).disabled === true ||
          htmlElement.getAttribute("aria-disabled") === "true",
        visible,
        boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });
    }
    return items;

    function buildSelector(element: Element): string {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const testId = element.getAttribute("data-testid");
      if (testId) return `[data-testid="${testId}"]`;
      const name = element.getAttribute("name");
      if (name && ["input", "select", "textarea", "button"].includes(element.tagName.toLowerCase())) {
        return `${element.tagName.toLowerCase()}[name="${name}"]`;
      }
      const nth = Array.from(element.parentElement?.children ?? []).indexOf(element) + 1;
      return `${element.tagName.toLowerCase()}:nth-child(${nth})`;
    }
  });
}

export async function readActiveFocusStep(
  page: Page,
  index: number,
  direction: "forward" | "backward",
  viewportWidth: number,
  viewportHeight: number,
): Promise<FocusStep> {
  return page.evaluate(
    ({ index, direction, viewportWidth, viewportHeight }) => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) {
        return {
          index,
          direction,
          visible: false,
          inViewport: false,
        } satisfies FocusStep;
      }
      const style = window.getComputedStyle(active);
      const rect = active.getBoundingClientRect();
      const tabindexAttr = active.getAttribute("tabindex");
      const tabindex = tabindexAttr === null ? undefined : Number(tabindexAttr);
      const visible =
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0;
      const inViewport =
        visible &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < viewportWidth &&
        rect.top < viewportHeight;
      return {
        index,
        direction,
        target: [buildSelector(active)],
        role: active.getAttribute("role") ?? active.tagName.toLowerCase(),
        accessibleName: active.getAttribute("aria-label") ?? active.textContent?.trim()?.slice(0, 120),
        tabindex: Number.isFinite(tabindex) ? tabindex : undefined,
        visible,
        inViewport,
        boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      } satisfies FocusStep;

      function buildSelector(element: Element): string {
        if (element.id) return `#${CSS.escape(element.id)}`;
        const testId = element.getAttribute("data-testid");
        if (testId) return `[data-testid="${testId}"]`;
        const nth = Array.from(element.parentElement?.children ?? []).indexOf(element) + 1;
        return `${element.tagName.toLowerCase()}:nth-child(${nth})`;
      }
    },
    { index, direction, viewportWidth, viewportHeight },
  );
}

export async function collectLayoutElements(page: Page): Promise<LayoutElementSnapshot[]> {
  return page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll("body *"));
    const snapshots: LayoutElementSnapshot[] = [];
    for (const element of elements) {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      const text = htmlElement.innerText?.trim().slice(0, 200);
      if (!text && !["button", "input", "select", "textarea", "a"].includes(htmlElement.tagName.toLowerCase())) {
        continue;
      }
      const visible =
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0;
      if (!visible && !text) continue;
      snapshots.push({
        target: [buildSelector(htmlElement)],
        tag: htmlElement.tagName.toLowerCase(),
        boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        visible,
        text,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollWidth: htmlElement.scrollWidth,
        clientWidth: htmlElement.clientWidth,
        scrollHeight: htmlElement.scrollHeight,
        clientHeight: htmlElement.clientHeight,
      });
      if (snapshots.length >= 250) break;
    }
    return snapshots;

    function buildSelector(element: Element): string {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const testId = element.getAttribute("data-testid");
      if (testId) return `[data-testid="${testId}"]`;
      const nth = Array.from(element.parentElement?.children ?? []).indexOf(element) + 1;
      return `${element.tagName.toLowerCase()}:nth-child(${nth})`;
    }
  });
}

export async function collectMotionRecords(page: Page): Promise<MotionRecord[]> {
  return page.evaluate(() => {
    const records: MotionRecord[] = [];
    const animations = document.getAnimations();
    for (const animation of animations) {
      const effect = animation.effect as KeyframeEffect | null;
      const targetElement = effect?.target as Element | undefined;
      const target = targetElement ? [buildSelector(targetElement)] : ["html"];
      records.push({
        target,
        animationName: animation.id || effect?.getKeyframes()?.[0]?.offset?.toString(),
        durationMs: animation.effect ? (animation.effect as KeyframeEffect).getTiming().duration as number : undefined,
        delayMs: animation.effect ? (animation.effect as KeyframeEffect).getTiming().delay as number : undefined,
        iterations: animation.effect
          ? ((animation.effect as KeyframeEffect).getTiming().iterations as number) === Infinity
            ? "infinite"
            : ((animation.effect as KeyframeEffect).getTiming().iterations as number)
          : undefined,
        playState: animation.playState,
        properties: effect?.getKeyframes().flatMap((frame) => Object.keys(frame)).filter((key) => key !== "offset" && key !== "easing"),
        source: "web-animation",
      });
      if (records.length >= 100) break;
    }

    for (const element of Array.from(document.querySelectorAll("*"))) {
      const style = window.getComputedStyle(element);
      if (style.animationName && style.animationName !== "none") {
        records.push({
          target: [buildSelector(element)],
          animationName: style.animationName,
          durationMs: Number.parseFloat(style.animationDuration) * 1000 || undefined,
          delayMs: Number.parseFloat(style.animationDelay) * 1000 || undefined,
          iterations: style.animationIterationCount === "infinite" ? "infinite" : Number(style.animationIterationCount),
          playState: style.animationPlayState,
          properties: [style.animationName],
          source: "css-animation",
        });
      }
      if (style.transitionDuration && style.transitionDuration !== "0s") {
        records.push({
          target: [buildSelector(element)],
          durationMs: Number.parseFloat(style.transitionDuration) * 1000 || undefined,
          properties: style.transitionProperty.split(",").map((value) => value.trim()),
          source: "css-transition",
        });
      }
      if (records.length >= 150) break;
    }
    return records;

    function buildSelector(element: Element): string {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const testId = element.getAttribute("data-testid");
      if (testId) return `[data-testid="${testId}"]`;
      const nth = Array.from(element.parentElement?.children ?? []).indexOf(element) + 1;
      return `${element.tagName.toLowerCase()}:nth-child(${nth})`;
    }
  });
}

export async function readMatchMediaReduce(page: Page): Promise<boolean> {
  return page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

export async function detectSmoothScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const htmlBehavior = window.getComputedStyle(html).scrollBehavior;
    const bodyBehavior = body ? window.getComputedStyle(body).scrollBehavior : "auto";
    return htmlBehavior === "smooth" || bodyBehavior === "smooth";
  });
}

export async function readPageDimensions(page: Page): Promise<{
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
}> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
  }));
}

export const TEXT_SCALE_STYLE_ID = "a11yst-large-text-profile";

export async function injectTextScale(page: Page, scale: number): Promise<void> {
  await page.addStyleTag({
    content: `
      #${TEXT_SCALE_STYLE_ID} { display: none; }
      html a11yst-large-text-profile-marker { display: none; }
      html { font-size: ${scale * 100}% !important; }
      body, body *:not(svg):not(path):not(img):not(video):not(canvas) {
        line-height: 1.5 !important;
      }
    `,
  });
}

export async function removeTextScale(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets) as CSSStyleSheet[]) {
      try {
        const rules = sheet.cssRules;
        for (let index = rules.length - 1; index >= 0; index -= 1) {
          const rule = rules[index];
          if (rule?.cssText.includes("a11yst-large-text-profile") || rule?.cssText.includes("font-size:")) {
            sheet.deleteRule(index);
          }
        }
      } catch {
        // Cross-origin stylesheets cannot be inspected.
      }
    }
  });
}
