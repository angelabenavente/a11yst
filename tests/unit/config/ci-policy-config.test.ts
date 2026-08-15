import { describe, expect, it } from "vitest";
import { defineConfig, validateConfig, ConfigError } from "@a11yst/config";
import { DEFAULT_CI_POLICY } from "@a11yst/types";

describe("ci policy config", () => {
  const webProject = {
    name: "website",
    platform: "web" as const,
    baseUrl: "http://localhost:3000",
    routes: ["/"],
  };

  it("applies default ci policy when ci is omitted", () => {
    const resolved = validateConfig(defineConfig({ projects: [webProject] }));
    expect(resolved.ci).toEqual(DEFAULT_CI_POLICY);
  });

  it("merges partial ci overrides", () => {
    const resolved = validateConfig(
      defineConfig({
        ci: { failOnNew: true },
        projects: [webProject],
      }),
    );
    expect(resolved.ci).toEqual({
      ...DEFAULT_CI_POLICY,
      failOnNew: true,
    });
  });

  it("preserves explicit full ci configuration", () => {
    const resolved = validateConfig(
      defineConfig({
        ci: {
          failOnNew: true,
          failOnRegression: true,
          failOnExpiredClassification: true,
          minimumSeverity: "critical",
        },
        projects: [webProject],
      }),
    );
    expect(resolved.ci).toEqual({
      failOnNew: true,
      failOnRegression: true,
      failOnExpiredClassification: true,
      minimumSeverity: "critical",
    });
  });

  it("rejects ci when not an object", () => {
    expect(() =>
      validateConfig({
        ci: true,
        projects: [webProject],
      }),
    ).toThrow(ConfigError);
  });

  it("rejects non-boolean failOnNew", () => {
    expect(() =>
      validateConfig({
        ci: { failOnNew: "yes" },
        projects: [webProject],
      }),
    ).toThrow(ConfigError);
  });

  it("rejects invalid minimumSeverity values", () => {
    expect(() =>
      validateConfig({
        ci: { minimumSeverity: "serious" },
        projects: [webProject],
      }),
    ).toThrow(ConfigError);
  });

  it("rejects unknown ci properties", () => {
    expect(() =>
      validateConfig({
        ci: { maxNew: 3 },
        projects: [webProject],
      }),
    ).toThrow(ConfigError);
  });

  it("does not mutate the input config object", () => {
    const input = defineConfig({
      ci: { failOnNew: true },
      projects: [webProject],
    });
    const snapshot = structuredClone(input);
    validateConfig(input);
    expect(input).toEqual(snapshot);
  });
});
