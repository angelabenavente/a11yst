import { resolve } from "node:path";
import {
  createAdapterContext,
  resolveAdapter,
  resolveReadiness,
} from "@a11yst/adapters";
import type { Diagnostic, PlannedRun, ResolvedReadinessConfig, ResolvedWebProject } from "@a11yst/types";
import type { Page } from "playwright";

const RECOMMENDED_SELECTOR_TIMEOUT_MS = 2_000;

export class ReadinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadinessError";
  }
}

export type MergedReadinessConfig = ResolvedReadinessConfig & {
  recommendedSelectors?: string[];
};

/**
 * Merge project readiness overrides with the adapter's recommended strategy.
 */
export function mergeRunReadiness(
  project: ResolvedWebProject,
  configDir: string,
  navigationTimeoutMs: number,
): MergedReadinessConfig {
  const projectRoot = resolve(configDir, project.rootDir);
  const context = createAdapterContext(projectRoot, configDir, project);
  const adapter = resolveAdapter({
    framework: project.framework,
    platform: project.platform,
  });
  const strategy = adapter?.getReadinessStrategy(context) ?? resolveReadiness();

  const merged: MergedReadinessConfig = {
    waitUntil: project.readiness.waitUntil ?? strategy.waitUntil ?? "domcontentloaded",
    timeout: project.readiness.timeout ?? strategy.timeout ?? navigationTimeoutMs,
  };

  if (project.readiness.selector !== undefined) {
    merged.selector = project.readiness.selector;
  }

  const settleFrames = project.readiness.settleFrames ?? strategy.settleFrames;
  if (settleFrames !== undefined) {
    merged.settleFrames = settleFrames;
  }

  if (strategy.selectors && strategy.selectors.length > 0) {
    const recommended = strategy.selectors.filter(
      (selector) => selector !== project.readiness.selector,
    );
    if (recommended.length > 0) {
      merged.recommendedSelectors = recommended;
    }
  }

  return merged;
}

/**
 * Wait for explicit and recommended readiness selectors, then settle animation
 * frames before axe analysis begins.
 */
export async function applyPageReadiness(
  page: Page,
  params: {
    readiness?: MergedReadinessConfig;
    navigationTimeoutMs: number;
    run?: PlannedRun;
  },
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const readiness = params.readiness;
  if (!readiness) {
    return diagnostics;
  }

  const selectorTimeout = readiness.timeout ?? params.navigationTimeoutMs;

  if (readiness.selector) {
    try {
      await page.waitForSelector(readiness.selector, { timeout: selectorTimeout });
    } catch {
      throw new ReadinessError(
        `Required readiness selector "${readiness.selector}" was not found within ${selectorTimeout}ms.`,
      );
    }
  }

  if (readiness.recommendedSelectors && readiness.recommendedSelectors.length > 0) {
    let found = false;
    for (const selector of readiness.recommendedSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: RECOMMENDED_SELECTOR_TIMEOUT_MS });
        found = true;
        break;
      } catch {
        // Try the next recommended selector.
      }
    }

    if (!found) {
      diagnostics.push({
        code: "READINESS_SELECTOR_MISSING",
        severity: "warning",
        message: `None of the recommended readiness selectors were found: ${readiness.recommendedSelectors.join(", ")}`,
        ...(params.run ? { path: `runs.${params.run.id}` } : {}),
      });
    }
  }

  const settleFrames = readiness.settleFrames ?? 0;
  if (settleFrames > 0) {
    await page.evaluate((count) => {
      const raf = (
        globalThis as unknown as {
          requestAnimationFrame: (callback: () => void) => number;
        }
      ).requestAnimationFrame;

      return new Promise<void>((resolvePromise) => {
        let remaining = count;
        const tick = (): void => {
          remaining -= 1;
          if (remaining <= 0) {
            resolvePromise();
            return;
          }
          raf(tick);
        };
        raf(tick);
      });
    }, settleFrames);
  }

  return diagnostics;
}
