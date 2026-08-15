import { describe, expect, it } from "vitest";
import { indexRepositorySources } from "@a11yst/source-index";
import { expectSorted, MONOREPO_FIXTURE, uris } from "./helpers.js";

describe("repository scopes", () => {
  it("uses the default repository scope", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
    });
    expect(result.summary.scopes).toBe(1);
    expect(result.files.every((file) => file.scopeIds.includes("repository"))).toBe(true);
  });

  it("indexes multiple scopes", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      scopes: [
        {
          id: "storefront",
          rootUri: "apps/storefront",
          projectName: "storefront",
          framework: "next",
        },
        {
          id: "admin",
          rootUri: "apps/admin-vue",
          projectName: "admin",
          framework: "vue",
        },
      ],
    });
    expect(result.summary.scopes).toBe(2);
    expect(uris(result)).toContain("apps/storefront/src/app/checkout/page.tsx");
    expect(uris(result)).toContain("apps/admin-vue/src/PaymentDialog.vue");
  });

  it("merges overlapping scopes into one indexed file", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      scopes: [
        {
          id: "packages",
          rootUri: "packages/ui",
          projectName: "ui",
          framework: "react",
        },
        {
          id: "repo",
          rootUri: ".",
          projectName: "monorepo",
        },
      ],
    });
    const button = result.files.find((file) => file.uri === "packages/ui/src/Button.tsx");
    expect(button?.scopeIds).toEqual(["packages", "repo"]);
    expect(button?.projectNames).toEqual(["monorepo", "ui"]);
    expect(button?.frameworks).toEqual(["react"]);
    expect(result.summary.duplicateFiles).toBeGreaterThan(0);
  });

  it("rejects unsafe scope roots", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      scopes: [{ id: "bad", rootUri: "../outside" }],
    });
    expect(result.status).toBe("invalid");
    expect(result.diagnostics.some((d) => d.code === "unsafe-scope-root")).toBe(true);
  });

  it("rejects missing scope directories", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      scopes: [{ id: "missing", rootUri: "apps/does-not-exist" }],
    });
    expect(result.status).toBe("invalid");
    expect(result.diagnostics.some((d) => d.code === "scope-not-found")).toBe(true);
  });

  it("sorts scopes deterministically in output metadata", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
      scopes: [
        { id: "b", rootUri: "packages/ui" },
        { id: "a", rootUri: "apps/storefront" },
      ],
    });
    for (const file of result.files) {
      expectSorted(file.scopeIds);
    }
  });
});
