import type { A11ystConfig } from "@a11yst/types";

/**
 * Marks an object as an a11yst configuration.
 * Provides identity typing for `a11yst.config.ts` files.
 */
export function defineConfig(config: A11ystConfig): A11ystConfig {
  return config;
}
