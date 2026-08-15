import type { RecommendationExampleLanguage } from "@a11yst/types";

export type NormalizedFramework = "html" | "react" | "next" | "vue" | "nuxt" | "angular" | "unknown";

const FRAMEWORK_ALIASES: Record<string, NormalizedFramework> = {
  html: "html",
  vanilla: "html",
  react: "react",
  next: "next",
  nextjs: "next",
  vue: "vue",
  nuxt: "nuxt",
  angular: "angular",
};

export function normalizeFramework(framework: string | undefined): NormalizedFramework {
  if (!framework) {
    return "unknown";
  }
  return FRAMEWORK_ALIASES[framework.toLowerCase()] ?? "unknown";
}

export function exampleLanguageForFramework(framework: NormalizedFramework): RecommendationExampleLanguage {
  switch (framework) {
    case "react":
      return "jsx";
    case "next":
      return "tsx";
    case "vue":
    case "nuxt":
      return "vue";
    case "angular":
      return "angular";
    case "html":
      return "html";
    default:
      return "text";
  }
}

export function labelAttributeForFramework(framework: NormalizedFramework): "for" | "htmlFor" {
  return framework === "react" || framework === "next" ? "htmlFor" : "for";
}
