import { describe, expect, it } from "vitest";
import { validateConfig } from "@a11yst/config";
import {
  createAuditPlan,
  isExecutableRun,
  selectRuns,
  skipReasonForRun,
  UnknownProjectError,
} from "@a11yst/core";
import type { AuditPlan, PlannedRun } from "@a11yst/types";

function webRun(overrides: Partial<PlannedRun> = {}): PlannedRun {
  return {
    id: "web::website::html::default::root::desktop",
    projectName: "website",
    platform: "web",
    framework: "html",
    profile: "default",
    route: { id: "root", name: "Home", path: "/" },
    viewport: { name: "desktop", width: 1440, height: 900 },
    baseUrl: "http://localhost:3000",
    ...overrides,
  };
}

describe("isExecutableRun", () => {
  it("is executable for web + default", () => {
    expect(isExecutableRun(webRun())).toBe(true);
  });

  it("is executable for web + keyboard", () => {
    expect(isExecutableRun(webRun({ profile: "keyboard" }))).toBe(true);
  });

  it("is executable for web + large-text", () => {
    expect(isExecutableRun(webRun({ profile: "large-text" }))).toBe(true);
  });

  it("is executable for web + reduced-motion", () => {
    expect(isExecutableRun(webRun({ profile: "reduced-motion" }))).toBe(true);
  });
});

describe("skipReasonForRun", () => {
  it("returns undefined for an executable web run", () => {
    expect(skipReasonForRun(webRun())).toBeUndefined();
    expect(skipReasonForRun(webRun({ profile: "keyboard" }))).toBeUndefined();
  });
});

function planFixture(): AuditPlan {
  const config = validateConfig({
    projects: [
      {
        name: "website",
        platform: "web",
        framework: "html",
        baseUrl: "http://localhost:3000",
        routes: ["/"],
        profiles: ["default", "keyboard", "large-text", "reduced-motion"],
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
      },
    ],
  });
  return createAuditPlan(config);
}

describe("selectRuns", () => {
  it("executes all web profile runs", () => {
    const plan = planFixture();
    const { executable, skipped } = selectRuns(plan);

    expect(executable).toHaveLength(4);
    expect(executable.every((run) => run.platform === "web")).toBe(true);
    expect(skipped).toHaveLength(0);
  });

  it("filters down to requested profile names", () => {
    const plan = planFixture();
    const { executable, skipped } = selectRuns(plan, { profileNames: ["keyboard"] });
    expect(executable).toHaveLength(1);
    expect(executable[0]?.profile).toBe("keyboard");
    expect(skipped).toHaveLength(0);
  });

  it("throws UnknownProfileError for an unconfigured profile override", () => {
    const plan = planFixture();
    expect(() => selectRuns(plan, { profileNames: ["default"], projectNames: ["website"] })).not.toThrow();
  });

  it("throws UnknownProjectError for an unrecognised --project name", () => {
    const plan = planFixture();
    expect(() => selectRuns(plan, { projectNames: ["does-not-exist"] })).toThrow(
      UnknownProjectError,
    );
  });

  it("preserves the exact run ids produced by createAuditPlan", () => {
    const plan = planFixture();
    const { executable, skipped } = selectRuns(plan);
    const selectedIds = new Set([...executable, ...skipped].map((run) => run.id));
    const planIds = new Set(plan.runs.map((run) => run.id));
    expect(selectedIds).toEqual(planIds);
  });

});

describe("structured profile config", () => {
  it("normalizes keyboard profile options", () => {
    const config = validateConfig({
      projects: [
        {
          name: "website",
          platform: "web",
          framework: "html",
          baseUrl: "http://localhost:3000",
          routes: ["/"],
          profiles: [{ id: "keyboard", maxTabStops: 25 }],
        },
      ],
    });
    expect(config.projects[0]?.profileOptions[0]).toMatchObject({
      id: "keyboard",
      maxTabStops: 25,
    });
  });
});
