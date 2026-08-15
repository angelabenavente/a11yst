import { describe, expect, it, vi } from "vitest";
import * as angularMapper from "@a11yst/source-mapping-angular";
import * as htmlMapper from "@a11yst/source-mapping-html";
import * as nextMapper from "@a11yst/source-mapping-next";
import * as nuxtMapper from "@a11yst/source-mapping-nuxt";
import * as reactMapper from "@a11yst/source-mapping-react";
import * as vueMapper from "@a11yst/source-mapping-vue";
import { analyzeFindingSources } from "@a11yst/source-analysis";
import { MONOREPO_FIXTURE, baseFinding } from "./fixtures.js";

async function runWithProject(framework: string, projectName: string, rootUri: string) {
  return analyzeFindingSources({
    repositoryRoot: MONOREPO_FIXTURE,
    projects: [{ id: projectName, rootUri, projectName, framework }],
    findings: [baseFinding({ projectName, route: "/", target: ["button#save"] })],
    options: { ranking: false, recommendations: false },
  });
}

describe("adapter selection", () => {
  it("invokes one primary mapper per framework", async () => {
    const spies = {
      html: vi.spyOn(htmlMapper, "mapHtmlSource"),
      react: vi.spyOn(reactMapper, "mapReactSource"),
      next: vi.spyOn(nextMapper, "mapNextSource"),
      vue: vi.spyOn(vueMapper, "mapVueSource"),
      nuxt: vi.spyOn(nuxtMapper, "mapNuxtSource"),
      angular: vi.spyOn(angularMapper, "mapAngularSource"),
    };

    await runWithProject("html", "legacy", "apps/legacy");
    await runWithProject("react", "ui", "packages/ui");
    await runWithProject("next", "storefront", "apps/storefront");
    await runWithProject("vue", "admin", "apps/admin-vue");
    await runWithProject("nuxt", "storefront", "apps/storefront");
    await runWithProject("angular", "portal", "apps/admin-angular");

    expect(spies.html).toHaveBeenCalled();
    expect(spies.react).toHaveBeenCalled();
    expect(spies.next).toHaveBeenCalled();
    expect(spies.vue).toHaveBeenCalled();
    expect(spies.nuxt).toHaveBeenCalled();
    expect(spies.angular).toHaveBeenCalled();

    Object.values(spies).forEach((spy) => spy.mockRestore());
  });
});
