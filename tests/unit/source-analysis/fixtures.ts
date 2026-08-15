import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Finding, SourceAnalysisProject } from "@a11yst/types";

export const MONOREPO_FIXTURE = resolve(
  fileURLToPath(new URL("../../fixtures/source-index/monorepo", import.meta.url)),
);

export function baseFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "finding-button-name",
    fingerprint: "button-name|storefront|/checkout|default|desktop|button#save",
    source: "axe",
    ruleId: "button-name",
    title: "Buttons must have discernible text",
    severity: "high",
    route: "/checkout",
    projectName: "storefront",
    profile: "default",
    viewport: "desktop",
    target: ["button#save"],
    standards: ["wcag2a"],
    ...overrides,
  };
}

export const storefrontProject: SourceAnalysisProject = {
  id: "storefront",
  rootUri: "apps/storefront",
  projectName: "storefront",
  framework: "next",
};

export const legacyProject: SourceAnalysisProject = {
  id: "legacy",
  rootUri: "apps/legacy",
  projectName: "legacy",
  framework: "html",
};
