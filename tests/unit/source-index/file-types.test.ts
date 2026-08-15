import { describe, expect, it } from "vitest";
import {
  classifySourceFile,
  indexRepositorySources,
  isGeneratedFile,
} from "@a11yst/source-index";
import { MONOREPO_FIXTURE, uris } from "./helpers.js";

describe("source file classification", () => {
  it("classifies supported extensions case-insensitively while preserving uri casing", () => {
    expect(classifySourceFile("src/Button.TSX")).toBe("tsx");
    expect(classifySourceFile("src/Button.tsx")).toBe("tsx");
    expect(classifySourceFile("src/page.HTML")).toBe("html");
  });

  it("classifies angular templates before generic html", () => {
    expect(classifySourceFile("src/payment.component.html")).toBe("angular-template");
    expect(classifySourceFile("src/checkout.html")).toBe("html");
  });

  it("indexes fixture file kinds from the monorepo", async () => {
    const result = await indexRepositorySources({ repositoryRoot: MONOREPO_FIXTURE });
    const byUri = new Map(result.files.map((file) => [file.uri, file.kind]));

    expect(byUri.get("apps/legacy/public/checkout.html")).toBe("html");
    expect(byUri.get("apps/admin-angular/src/payment.component.html")).toBe("angular-template");
    expect(byUri.get("apps/storefront/src/app/checkout/page.tsx")).toBe("tsx");
    expect(byUri.get("apps/admin-vue/src/PaymentDialog.vue")).toBe("vue");
    expect(byUri.get("apps/svelte-preview/src/App.svelte")).toBe("svelte");
    expect(byUri.get("apps/astro-preview/src/pages/index.astro")).toBe("astro");
    expect(byUri.get("apps/storefront/src/index.ts")).toBe("typescript");
  });

  it("counts unsupported and generated files without indexing them", async () => {
    const result = await indexRepositorySources({ repositoryRoot: MONOREPO_FIXTURE });
    expect(uris(result)).not.toContain("packages/ui/src/index.d.ts");
    expect(uris(result)).not.toContain("apps/storefront/src/generated/client.bundle.js");
    expect(uris(result)).not.toContain("apps/storefront/src/app.min.js");
    expect(uris(result)).not.toContain("apps/storefront/src/styles.css");
    expect(result.summary.generatedFiles).toBeGreaterThan(0);
    expect(result.summary.unsupportedFiles).toBeGreaterThan(0);
  });

  it("detects generated patterns", () => {
    expect(isGeneratedFile("dist/client.bundle.js")).toBe(true);
    expect(isGeneratedFile("src/index.d.ts")).toBe(true);
    expect(isGeneratedFile("src/app.min.js")).toBe(true);
    expect(isGeneratedFile("src/app.js.map")).toBe(true);
    expect(isGeneratedFile("src/index.ts")).toBe(false);
  });

  it("keeps normal index.ts files", async () => {
    const result = await indexRepositorySources({ repositoryRoot: MONOREPO_FIXTURE });
    expect(uris(result)).toContain("apps/storefront/src/index.ts");
  });
});
