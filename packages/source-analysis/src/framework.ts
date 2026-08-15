const FRAMEWORK_ALIASES: Record<string, NormalizedFramework> = {
  html: "html",
  vanilla: "html",
  react: "react",
  next: "next",
  nextjs: "next",
  vue: "vue",
  nuxt: "nuxt",
  angular: "angular",
  unknown: "unknown",
};

export type NormalizedFramework =
  | "html"
  | "react"
  | "next"
  | "vue"
  | "nuxt"
  | "angular"
  | "unknown";

export function normalizeFramework(value: string | undefined): NormalizedFramework {
  if (!value) {
    return "unknown";
  }
  const normalized = value.trim().toLowerCase();
  return FRAMEWORK_ALIASES[normalized] ?? "unknown";
}

export function isSupportedMapperFramework(framework: NormalizedFramework): boolean {
  return framework !== "unknown";
}
