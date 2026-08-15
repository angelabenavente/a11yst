import { describe, expect, it } from "vitest";
import { indexRepositorySources, resolveSourceIndexOptions, SourceIndexValidationError } from "@a11yst/source-index";
import { MONOREPO_FIXTURE } from "./helpers.js";

describe("repository root handling", () => {
  it("indexes a valid absolute repository root", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
    });
    expect(result.status).toBe("complete");
    expect(result.files.length).toBeGreaterThan(0);
  });

  it("rejects a missing repository root", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: `${MONOREPO_FIXTURE}/missing-root`,
    });
    expect(result.status).toBe("invalid");
    expect(result.diagnostics.some((d) => d.code === "repository-root-not-found")).toBe(true);
  });

  it("rejects a file used as repository root", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: `${MONOREPO_FIXTURE}/apps/storefront/src/index.ts`,
    });
    expect(result.status).toBe("invalid");
    expect(result.diagnostics.some((d) => d.code === "repository-root-not-directory")).toBe(
      true,
    );
  });

  it("rejects a relative repository root", async () => {
    await expect(
      indexRepositorySources({
        repositoryRoot: "tests/fixtures/source-index/monorepo",
      }),
    ).resolves.toMatchObject({ status: "invalid" });
  });

  it("does not expose absolute repository root in results", async () => {
    const result = await indexRepositorySources({
      repositoryRoot: MONOREPO_FIXTURE,
    });
    const serialized = JSON.stringify(result);
    expect(serialized.includes(MONOREPO_FIXTURE)).toBe(false);
  });

  it("rejects invalid option values", () => {
    expect(() => resolveSourceIndexOptions({ maxFiles: 0 })).toThrow(
      SourceIndexValidationError,
    );
    expect(() => resolveSourceIndexOptions({ maxDepth: -1 })).toThrow(
      SourceIndexValidationError,
    );
    expect(() => resolveSourceIndexOptions({ maxFileSizeBytes: 1.5 })).toThrow(
      SourceIndexValidationError,
    );
    expect(() => resolveSourceIndexOptions({ maxFiles: Number.NaN })).toThrow(
      SourceIndexValidationError,
    );
    expect(() => resolveSourceIndexOptions({ maxFiles: Number.POSITIVE_INFINITY })).toThrow(
      SourceIndexValidationError,
    );
  });
});
