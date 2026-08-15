import type {
  DetectionConfidence,
  DetectionEvidence,
  Diagnostic,
  FrameworkDetection,
  Platform,
  SupportLevel,
  WebFramework,
} from "@a11yst/types";
import { configFileVariants, findExistingFile, type WalkedEntry } from "./filesystem.js";
import {
  dependencyEvidenceType,
  hasAnyDependency,
  hasDependency,
  listScripts,
  type PackageManifest,
} from "./manifests.js";
import { sortEvidence, sumWeights } from "./evidence.js";

/** Every host framework this package can recognise, `"unknown"` excluded. */
export type HostFramework = Exclude<WebFramework, "unknown">;

/**
 * Host-framework resolution priority, highest first. When multiple hosts
 * have non-trivial evidence (for example a Next.js app also satisfies some
 * React evidence), the earlier entry always wins — this is what lets
 * meta-frameworks beat the libraries they are built on.
 */
export const HOST_PRIORITY: readonly (HostFramework | "unknown")[] = [
  "next",
  "nuxt",
  "sveltekit",
  "astro",
  "angular",
  "qwik",
  "ember",
  "solid",
  "preact",
  "svelte",
  "vue",
  "react",
  "lit",
  "html",
  "unknown",
];

/** Minimum aggregate score required for a framework to be a viable winner. */
const ACTIVATION_THRESHOLD = 2;

/** Frameworks that share a "family" are not treated as ambiguous competitors. */
const FRAMEWORK_FAMILY: Readonly<Record<HostFramework, string>> = {
  next: "react",
  react: "react",
  nuxt: "vue",
  vue: "vue",
  sveltekit: "svelte",
  svelte: "svelte",
  astro: "astro",
  angular: "angular",
  qwik: "qwik",
  ember: "ember",
  solid: "solid",
  preact: "preact",
  lit: "lit",
  html: "html",
};

export const SUPPORT_LEVELS: Readonly<Record<HostFramework | "unknown", SupportLevel>> = {
  html: "first-class",
  react: "first-class",
  next: "first-class",
  angular: "first-class",
  vue: "first-class",
  nuxt: "first-class",
  svelte: "preview",
  sveltekit: "preview",
  astro: "runtime-compatible",
  preact: "runtime-compatible",
  solid: "runtime-compatible",
  qwik: "runtime-compatible",
  ember: "runtime-compatible",
  lit: "runtime-compatible",
  unknown: "unknown",
};

interface FrameworkContext {
  rootDir: string;
  manifest: PackageManifest | undefined;
  entries: readonly WalkedEntry[];
}

function dep(
  ctx: FrameworkContext,
  name: string,
  weight: number,
  description?: string,
): DetectionEvidence | undefined {
  const kind = dependencyEvidenceType(ctx.manifest, name);
  if (!kind) {
    return undefined;
  }
  return {
    type: kind,
    value: name,
    description: description ?? `Depends on "${name}".`,
    weight,
  };
}

function configFile(
  ctx: FrameworkContext,
  baseName: string,
  weight: number,
  description: string,
  extensions?: readonly string[],
): DetectionEvidence | undefined {
  const match = findExistingFile(ctx.rootDir, configFileVariants(baseName, extensions));
  if (!match) {
    return undefined;
  }
  return { type: "file", value: match, description, weight };
}

function exactFile(
  ctx: FrameworkContext,
  fileName: string,
  weight: number,
  description: string,
): DetectionEvidence | undefined {
  const match = findExistingFile(ctx.rootDir, [fileName]);
  if (!match) {
    return undefined;
  }
  return { type: "file", value: match, description, weight };
}

function dir(
  ctx: FrameworkContext,
  relativePath: string,
  weight: number,
  description: string,
): DetectionEvidence | undefined {
  const found = ctx.entries.some((e) => e.isDirectory && e.relativePath === relativePath);
  if (!found) {
    return undefined;
  }
  return { type: "directory", value: relativePath, description, weight };
}

function script(
  ctx: FrameworkContext,
  pattern: RegExp,
  weight: number,
  description: string,
): DetectionEvidence | undefined {
  for (const [name, value] of Object.entries(listScripts(ctx.manifest))) {
    if (typeof value === "string" && pattern.test(value)) {
      return {
        type: "package-script",
        value: `${name}: ${value}`,
        description,
        weight,
      };
    }
  }
  return undefined;
}

function countFilesWithExtension(ctx: FrameworkContext, extension: string): number {
  const suffix = extension.startsWith(".") ? extension : `.${extension}`;
  return ctx.entries.filter(
    (e) => !e.isDirectory && e.relativePath.toLowerCase().endsWith(suffix),
  ).length;
}

function fileExtensionEvidence(
  ctx: FrameworkContext,
  extension: string,
  weight: number,
  description: string,
): DetectionEvidence | undefined {
  const count = countFilesWithExtension(ctx, extension);
  if (count === 0) {
    return undefined;
  }
  return { type: "file", value: `*${extension} (${count})`, description, weight };
}

function present<T>(values: (T | undefined)[]): T[] {
  return values.filter((value): value is T => value !== undefined);
}

const EVIDENCE_BUILDERS: Readonly<Record<HostFramework, (ctx: FrameworkContext) => DetectionEvidence[]>> = {
  next: (ctx) =>
    present([
      dep(ctx, "next", 4, 'Depends on "next".'),
      configFile(ctx, "next.config", 3, "Found a Next.js configuration file."),
      dir(ctx, "app", 2, 'Found an "app" directory (Next.js App Router convention).'),
      dir(ctx, "pages", 1, 'Found a "pages" directory (Next.js Pages Router convention).'),
      dir(ctx, "src/app", 2, 'Found a "src/app" directory (Next.js App Router convention).'),
      dir(ctx, "src/pages", 1, 'Found a "src/pages" directory (Next.js Pages Router convention).'),
      script(ctx, /\bnext\b/, 1, 'A package.json script invokes "next".'),
    ]),

  nuxt: (ctx) =>
    present([
      dep(ctx, "nuxt", 4, 'Depends on "nuxt".'),
      configFile(ctx, "nuxt.config", 3, "Found a Nuxt configuration file."),
      dir(ctx, "pages", 1, 'Found a "pages" directory (Nuxt file-based routing convention).'),
      dir(ctx, "layouts", 1, 'Found a "layouts" directory (Nuxt convention).'),
      script(ctx, /\bnuxi?\b/, 1, 'A package.json script invokes "nuxt"/"nuxi".'),
    ]),

  sveltekit: (ctx) =>
    present([
      dep(ctx, "@sveltejs/kit", 4, 'Depends on "@sveltejs/kit".'),
      configFile(ctx, "svelte.config", 3, "Found a Svelte configuration file.", ["js", "ts"]),
      dir(ctx, "src/routes", 2, 'Found a "src/routes" directory (SvelteKit routing convention).'),
      script(ctx, /svelte-kit/, 1, 'A package.json script invokes "svelte-kit".'),
    ]),

  astro: (ctx) =>
    present([
      dep(ctx, "astro", 4, 'Depends on "astro".'),
      configFile(ctx, "astro.config", 3, "Found an Astro configuration file."),
      dir(ctx, "src/pages", 1, 'Found a "src/pages" directory (Astro routing convention).'),
      dir(ctx, "src/content", 1, 'Found a "src/content" directory (Astro content collections).'),
      script(ctx, /\bastro\b/, 1, 'A package.json script invokes "astro".'),
    ]),

  angular: (ctx) =>
    present([
      exactFile(ctx, "angular.json", 4, 'Found "angular.json", the Angular workspace config.'),
      dep(ctx, "@angular/core", 3, 'Depends on "@angular/core".'),
      dep(ctx, "@angular/cli", 2, 'Depends on "@angular/cli".'),
      script(ctx, /\bng\b/, 1, 'A package.json script invokes the Angular CLI ("ng").'),
    ]),

  qwik: (ctx) =>
    present([
      dep(ctx, "@builder.io/qwik", 4, 'Depends on "@builder.io/qwik".'),
      dep(ctx, "@builder.io/qwik-city", 2, 'Depends on "@builder.io/qwik-city".'),
      script(ctx, /\bqwik\b/, 1, 'A package.json script invokes "qwik".'),
    ]),

  ember: (ctx) =>
    present([
      dep(ctx, "ember-cli", 3, 'Depends on "ember-cli".'),
      dep(ctx, "ember-source", 3, 'Depends on "ember-source".'),
      exactFile(ctx, ".ember-cli", 2, 'Found ".ember-cli" configuration file.'),
      script(ctx, /\bember\b/, 1, 'A package.json script invokes "ember".'),
    ]),

  solid: (ctx) =>
    present([
      dep(ctx, "solid-js", 4, 'Depends on "solid-js".'),
      dep(ctx, "solid-start", 2, 'Depends on "solid-start".'),
      dep(ctx, "vite-plugin-solid", 2, 'Depends on "vite-plugin-solid".'),
      script(ctx, /\bsolid\b/, 1, 'A package.json script invokes "solid".'),
    ]),

  preact: (ctx) =>
    present([
      dep(ctx, "preact", 4, 'Depends on "preact".'),
      dep(ctx, "@preact/preset-vite", 2, 'Depends on "@preact/preset-vite".'),
      script(ctx, /\bpreact\b/, 1, 'A package.json script invokes "preact".'),
    ]),

  svelte: (ctx) =>
    present([
      dep(ctx, "svelte", 4, 'Depends on "svelte".'),
      dep(ctx, "@sveltejs/vite-plugin-svelte", 2, 'Depends on "@sveltejs/vite-plugin-svelte".'),
      configFile(ctx, "svelte.config", 1, "Found a Svelte configuration file.", ["js", "ts"]),
      fileExtensionEvidence(ctx, ".svelte", 1, "Found .svelte component files."),
    ]),

  vue: (ctx) =>
    present([
      dep(ctx, "vue", 4, 'Depends on "vue".'),
      dep(ctx, "@vitejs/plugin-vue", 2, 'Depends on "@vitejs/plugin-vue".'),
      dep(ctx, "vue-router", 1, 'Depends on "vue-router".'),
      fileExtensionEvidence(ctx, ".vue", 1, "Found .vue single-file components."),
    ]),

  react: (ctx) => {
    const evidence = present([
      dep(ctx, "react", 2, 'Depends on "react".'),
      dep(ctx, "react-dom", 2, 'Depends on "react-dom".'),
      dep(ctx, "@vitejs/plugin-react", 2, 'Depends on "@vitejs/plugin-react".'),
      dep(ctx, "react-scripts", 2, 'Depends on "react-scripts" (Create React App).'),
      fileExtensionEvidence(ctx, ".tsx", 1, "Found .tsx component files."),
      fileExtensionEvidence(ctx, ".jsx", 1, "Found .jsx component files."),
    ]);
    return evidence;
  },

  lit: (ctx) =>
    present([
      dep(ctx, "lit", 4, 'Depends on "lit".'),
      dep(ctx, "lit-element", 2, 'Depends on "lit-element".'),
      dep(ctx, "lit-html", 1, 'Depends on "lit-html".'),
    ]),

  html: (ctx) => {
    const htmlCount = countFilesWithExtension(ctx, ".html");
    const hasRootIndex = ctx.entries.some(
      (e) => !e.isDirectory && e.relativePath === "index.html",
    );
    const hasVite = hasDependency(ctx.manifest, "vite");
    const hasFrameworkVitePlugin = hasAnyDependency(ctx.manifest, [
      "@vitejs/plugin-react",
      "@vitejs/plugin-vue",
      "@sveltejs/vite-plugin-svelte",
      "vite-plugin-solid",
      "@preact/preset-vite",
    ]);

    return present([
      htmlCount > 0
        ? {
            type: "file" as const,
            value: `*.html (${htmlCount})`,
            description: `Found ${htmlCount} static .html file(s).`,
            weight: 2,
          }
        : undefined,
      hasRootIndex
        ? {
            type: "file" as const,
            value: "index.html",
            description: 'Found a root "index.html" entry point.',
            weight: 1,
          }
        : undefined,
      hasVite && !hasFrameworkVitePlugin
        ? {
            type: "dependency" as const,
            value: "vite",
            description: 'Depends on "vite" without any known UI-framework Vite plugin.',
            weight: 1,
          }
        : undefined,
      script(
        ctx,
        /\b(?:http-server|live-server|serve)\b/,
        1,
        "A package.json script serves static files.",
      ),
    ]);
  },
};

function isCloseAlternative(winnerScore: number, alternativeScore: number): boolean {
  if (winnerScore <= 0) {
    return false;
  }
  return alternativeScore / winnerScore >= 0.7;
}

function computeConfidence(options: {
  winner: HostFramework | "unknown";
  winnerScore: number;
  winnerEvidence: readonly DetectionEvidence[];
  topDifferentFamilyScore: number;
}): DetectionConfidence {
  const { winner, winnerScore, winnerEvidence, topDifferentFamilyScore } = options;

  if (winner === "unknown" || winnerScore <= 0) {
    return "unknown";
  }

  const hasConfigEvidence = winnerEvidence.some((e) => e.type === "file" && e.weight >= 3);
  const hasDepEvidence = winnerEvidence.some(
    (e) => e.type === "dependency" || e.type === "devDependency",
  );
  const hasScriptEvidence = winnerEvidence.some((e) => e.type === "package-script");
  const closeAlternative = isCloseAlternative(winnerScore, topDifferentFamilyScore);

  if (hasConfigEvidence && hasDepEvidence && hasScriptEvidence && !closeAlternative) {
    return "certain";
  }
  if (winnerScore < ACTIVATION_THRESHOLD) {
    return "low";
  }
  if (closeAlternative) {
    return topDifferentFamilyScore / winnerScore >= 0.85 ? "low" : "medium";
  }
  return "high";
}

function platformFor(framework: HostFramework | "unknown"): Platform | "unknown" {
  if (framework === "unknown") {
    return "unknown";
  }
  return "web";
}

/**
 * Detect the web framework used by a single project root from
 * static evidence only (manifest contents + limited filesystem walk).
 *
 * Selection is priority-first: the highest-priority host in
 * {@link HOST_PRIORITY} whose evidence score reaches the activation
 * threshold wins, even when a lower-priority framework (e.g. the "react"
 * a Next.js app also depends on) scores similarly or higher. This is what
 * implements rules like "Next beats React" and "Astro beats island
 * frameworks" deterministically.
 */
export function detectFramework(
  rootDir: string,
  manifest: PackageManifest | undefined,
  entries: readonly WalkedEntry[],
): FrameworkDetection {
  const ctx: FrameworkContext = { rootDir, manifest, entries };
  const diagnostics: Diagnostic[] = [];

  const scored = new Map<HostFramework, DetectionEvidence[]>();
  for (const framework of HOST_PRIORITY) {
    if (framework === "unknown") {
      continue;
    }
    scored.set(framework, sortEvidence(EVIDENCE_BUILDERS[framework](ctx)));
  }

  const scoreOf = (framework: HostFramework): number => sumWeights(scored.get(framework)!);

  let winner: HostFramework | "unknown" = "unknown";
  for (const framework of HOST_PRIORITY) {
    if (framework === "unknown") {
      winner = "unknown";
      break;
    }
    if (scoreOf(framework) >= ACTIVATION_THRESHOLD) {
      winner = framework;
      break;
    }
  }

  const winnerScore = winner === "unknown" ? 0 : scoreOf(winner);
  const winnerFamily = winner === "unknown" ? undefined : FRAMEWORK_FAMILY[winner];

  const allCandidates = (HOST_PRIORITY.filter(
    (f): f is HostFramework => f !== "unknown",
  ) as HostFramework[])
    .map((framework) => ({
      framework,
      score: scoreOf(framework),
      evidence: scored.get(framework)!,
    }))
    .filter((candidate) => candidate.framework !== winner && candidate.score > 0);

  const differentFamilyCandidates = allCandidates.filter(
    (candidate) => FRAMEWORK_FAMILY[candidate.framework] !== winnerFamily,
  );
  const topDifferentFamilyScore = differentFamilyCandidates.reduce(
    (max, candidate) => Math.max(max, candidate.score),
    0,
  );
  const topDifferentFamily = differentFamilyCandidates.find(
    (candidate) => candidate.score === topDifferentFamilyScore,
  );

  const alternatives = [...allCandidates].sort(
    (a, b) => b.score - a.score || (a.framework < b.framework ? -1 : 1),
  );

  const winnerEvidence = winner === "unknown" ? [] : scored.get(winner)!;

  const confidence = computeConfidence({
    winner,
    winnerScore,
    winnerEvidence,
    topDifferentFamilyScore,
  });

  if (winner === "unknown") {
    diagnostics.push({
      code: "FRAMEWORK_UNKNOWN",
      severity: "info",
      message: "No recognizable framework signals were found for this project.",
      hint: "Set an explicit framework in your a11yst config if you know it.",
      path: rootDir,
    });
  } else if (
    topDifferentFamily &&
    isCloseAlternative(winnerScore, topDifferentFamilyScore) &&
    (confidence === "medium" || confidence === "low")
  ) {
    diagnostics.push({
      code: "FRAMEWORK_AMBIGUOUS",
      severity: "warning",
      message: `Framework detection chose "${winner}" (score ${winnerScore}) over "${topDifferentFamily.framework}" (score ${topDifferentFamily.score}) by priority, but the scores are close.`,
      hint: "Set an explicit framework in your a11yst config to remove ambiguity.",
      path: rootDir,
    });
  }

  return {
    platform: platformFor(winner),
    framework: winner,
    supportLevel: SUPPORT_LEVELS[winner],
    confidence,
    score: winnerScore,
    evidence: winnerEvidence,
    alternatives,
    diagnostics,
  };
}
