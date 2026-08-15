import type { OutputKind } from "./types.js";

export function shouldRenderBranding(options: {
  outputKind: OutputKind;
}): boolean {
  return options.outputKind === "human";
}
