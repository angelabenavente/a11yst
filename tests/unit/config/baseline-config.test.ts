import { describe, expect, it } from "vitest";
import { defineConfig, validateConfig } from "@a11yst/config";

describe("baseline config defaults", () => {
  it("applies default baseline settings when omitted", () => {
    const resolved = validateConfig(
      defineConfig({
        projects: [
          {
            name: "website",
            platform: "web",
            baseUrl: "http://localhost:3000",
            routes: ["/"],
          },
        ],
      }),
    );

    expect(resolved.baseline).toEqual({
      file: ".a11yst/baseline.json",
      compare: true,
      classifications: true,
    });
  });

  it("preserves explicit baseline overrides", () => {
    const resolved = validateConfig(
      defineConfig({
        baseline: {
          file: "custom/baseline.json",
          compare: false,
          classifications: false,
        },
        projects: [
          {
            name: "website",
            platform: "web",
            baseUrl: "http://localhost:3000",
            routes: ["/"],
          },
        ],
      }),
    );

    expect(resolved.baseline).toEqual({
      file: "custom/baseline.json",
      compare: false,
      classifications: false,
    });
  });
});
