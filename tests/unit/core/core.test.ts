import { describe, expect, it } from "vitest";
import { validateConfig } from "@a11yst/config";
import { buildRunId, createAuditPlan } from "@a11yst/core";

describe("@a11yst/core createAuditPlan", () => {
  it("computes web runs as routes × profiles × viewports", () => {
    const config = validateConfig({
      projects: [
        {
          name: "website",
          platform: "web",
          framework: "react",
          baseUrl: "http://localhost:3000",
          routes: ["/", "/about"],
          profiles: ["default", "keyboard"],
          viewports: [
            { name: "mobile", width: 390, height: 844 },
            { name: "desktop", width: 1440, height: 900 },
          ],
        },
      ],
    });

    const plan = createAuditPlan(config);
    expect(plan.totalRuns).toBe(8);
    expect(plan.runs).toHaveLength(8);
  });

  it("produces deterministic plans and stable ids", () => {
    const input = {
      projects: [
        {
          name: "website",
          platform: "web" as const,
          framework: "html" as const,
          baseUrl: "http://localhost:4173",
          routes: ["/", "/about"],
          profiles: ["default" as const],
          viewports: [{ name: "desktop", width: 1440, height: 900 }],
        },
      ],
    };

    const planA = createAuditPlan(validateConfig(input));
    const planB = createAuditPlan(validateConfig(input));

    expect(planA.runs.map((run) => run.id)).toEqual(
      planB.runs.map((run) => run.id),
    );
    expect(planA.totalRuns).toBe(2);
    expect(planA.runs[0]?.id).toBe(
      buildRunId({
        projectName: "website",
        platform: "web",
        framework: "html",
        profile: "default",
        routePath: "/",
        viewportName: "desktop",
      }),
    );
    expect(planA.runs[0]?.id).toBe(
      "web::website::html::default::root::desktop",
    );
  });

  it("rejects react-native and expo projects as web-only configuration", () => {
    expect(() =>
      validateConfig({
        projects: [
          {
            name: "mobile-app",
            platform: "react-native",
            framework: "expo",
            profiles: ["default", "large-text"],
          },
        ],
      }),
    ).toThrow(/invalid/i);
  });

  it("rejects mixed web and native configs", () => {
    expect(() =>
      validateConfig({
        projects: [
          {
            name: "website",
            platform: "web",
            framework: "vue",
            baseUrl: "http://localhost:3000",
            routes: ["/"],
            profiles: ["default"],
            viewports: [{ name: "desktop", width: 1440, height: 900 }],
          },
          {
            name: "mobile-app",
            platform: "react-native",
            framework: "react-native",
            profiles: ["default", "keyboard"],
          },
        ],
      }),
    ).toThrow(/invalid/i);
  });

  it("includes non-blocking diagnostics", () => {
    const config = validateConfig({
      projects: [
        {
          name: "website",
          platform: "web",
          baseUrl: "http://localhost:3000",
          routes: ["/"],
        },
      ],
    });
    const plan = createAuditPlan(config);
    expect(plan.diagnostics.some((d) => d.code === "WEB_ENGINE_AVAILABLE")).toBe(
      true,
    );
    expect(plan.diagnostics.some((d) => d.code === "UNKNOWN_FRAMEWORK")).toBe(
      true,
    );
    expect(plan.diagnostics.every((d) => d.severity !== "error")).toBe(true);
  });

  it("does not mutate the input configuration", () => {
    const config = validateConfig({
      projects: [
        {
          name: "website",
          platform: "web",
          framework: "react",
          baseUrl: "http://localhost:3000",
          routes: ["/"],
          profiles: ["default"],
          viewports: [{ name: "desktop", width: 1440, height: 900 }],
        },
      ],
    });
    const before = structuredClone(config);
    createAuditPlan(config);
    expect(config).toEqual(before);
  });
});
