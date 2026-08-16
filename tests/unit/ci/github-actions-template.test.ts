import { describe, expect, it } from "vitest";
import {
  CI_PATHS,
  countOccurrences,
  getGitHubJob,
  parseTemplate,
  readTemplate,
} from "./helpers.js";

describe("GitHub Actions CI templates", () => {
  const templates = [
    { name: "base", path: CI_PATHS.githubBase },
    { name: "code-scanning", path: CI_PATHS.githubCodeScanning },
  ] as const;

  for (const template of templates) {
    describe(template.name, () => {
      const raw = readTemplate(template.path);
      const doc = parseTemplate(template.path) as Record<string, unknown>;

      it("parses as valid YAML with expected root keys", () => {
        expect(doc.name).toBeTypeOf("string");
        expect(doc.on).toBeDefined();
        expect(doc.jobs).toBeDefined();
      });

      it("defines expected triggers without pull_request_target", () => {
        const on = doc.on as Record<string, unknown>;
        expect(on.pull_request).toBeDefined();
        expect(on.push).toBeDefined();
        expect(on.workflow_dispatch).toBeDefined();
        expect(raw).not.toContain("pull_request_target");
      });

      it("uses versioned actions and avoids unsafe refs", () => {
        expect(raw).toContain("actions/checkout@v7");
        expect(raw).toContain("actions/setup-node@v7");
        expect(raw).toContain("actions/upload-artifact@v4");
        expect(raw).not.toMatch(/@(main|master|latest)\b/);
      });

      it("enables Corepack, frozen install, and Chromium", () => {
        expect(raw).toContain("corepack enable");
        expect(raw).toContain("pnpm install --frozen-lockfile");
        expect(raw).toContain("playwright install --with-deps chromium");
      });

      it("runs exactly one a11yst audit with policy and report flags", () => {
        expect(countOccurrences(raw, "pnpm exec a11yst audit")).toBe(1);
        expect(raw).toContain("--fail-on-new");
        expect(raw).toContain("--fail-on-regression");
        expect(raw).toContain("--fail-on-expired-classification");
        expect(raw).toContain("--minimum-severity high");
        expect(raw).toContain("--sarif-output .a11yst/ci/a11yst.sarif");
        expect(raw).toContain("--junit-output .a11yst/ci/a11yst.junit.xml");
        expect(raw).toContain("--markdown-output .a11yst/ci/a11yst.md");
        expect(raw).toContain(
          "--github-annotations-output .a11yst/ci/github-annotations.txt",
        );
        expect(raw).toContain("--github-step-summary");
        expect(raw).toContain("--json > .a11yst/ci/a11yst-results.json");
      });

      it("captures exit code and applies a final gate preserving 0/1/2", () => {
        expect(raw).toContain("set +e");
        expect(raw).toContain("status=$?");
        expect(raw).toContain("set -e");
        expect(raw).toContain("exit_code=");
        expect(raw).toContain('case "$A11YST_EXIT_CODE" in');
        expect(raw).toContain("0) exit 0 ;;");
        expect(raw).toContain("1) exit 1 ;;");
        expect(raw).toContain("2) exit 2 ;;");
        expect(raw).not.toMatch(/a11yst audit[\s\S]*\|\| true/);
      });

      it("emits annotations safely and uploads artifacts on always()", () => {
        const job = getGitHubJob(doc);
        const steps = job.steps as Array<Record<string, unknown>>;
        const annotationStep = steps.find((step) => step.name === "Emit a11yst annotations");
        const artifactStep = steps.find((step) => step.name === "Upload a11yst artifacts");
        expect(annotationStep?.if).toBe("always()");
        expect(artifactStep?.if).toBe("always()");
        expect(String(annotationStep?.run)).toContain("cat .a11yst/ci/github-annotations.txt");
        expect(String(annotationStep?.run)).not.toContain("source");
        expect(String(annotationStep?.run)).not.toContain("eval");
        expect(String(artifactStep?.uses)).toContain("actions/upload-artifact@v4");
        expect(raw).toContain(".a11yst/ci/");
        expect(raw).toContain(".a11yst/results/");
      });

      it("reads Node version from .nvmrc", () => {
        expect(raw).toContain("node-version-file: .nvmrc");
      });

      it("does not use personal tokens or broad write permissions", () => {
        expect(raw).not.toMatch(/secrets\.(GITHUB_TOKEN|PAT|TOKEN)/i);
        expect(raw).not.toContain("write-all");
        expect(raw).not.toContain("pull-requests: write");
        expect(raw).not.toContain("contents: write");
      });
    });
  }

  describe("base template permissions", () => {
    const doc = parseTemplate(CI_PATHS.githubBase) as Record<string, unknown>;

    it("requests only contents: read", () => {
      const permissions = doc.permissions as Record<string, string>;
      expect(permissions.contents).toBe("read");
      expect(Object.keys(permissions)).toEqual(["contents"]);
    });

    it("does not upload SARIF", () => {
      const raw = readTemplate(CI_PATHS.githubBase);
      expect(raw).not.toContain("upload-sarif");
      expect(raw).not.toContain("security-events: write");
    });
  });

  describe("code-scanning template", () => {
    const raw = readTemplate(CI_PATHS.githubCodeScanning);
    const doc = parseTemplate(CI_PATHS.githubCodeScanning) as Record<string, unknown>;

    it("adds security-events write without write-all", () => {
      const permissions = doc.permissions as Record<string, string>;
      expect(permissions.contents).toBe("read");
      expect(permissions["security-events"]).toBe("write");
      expect(raw).not.toContain("write-all");
    });

    it("uploads generated SARIF with codeql upload action", () => {
      expect(raw).toContain("github/codeql-action/upload-sarif@v4");
      expect(raw).toContain("sarif_file: .a11yst/ci/a11yst.sarif");
      expect(raw).toContain("category: a11yst");
      expect(raw).toContain("hashFiles('.a11yst/ci/a11yst.sarif')");
      expect(countOccurrences(raw, "pnpm exec a11yst audit")).toBe(1);
    });

    it("skips privileged SARIF upload on fork pull requests without skipping audit", () => {
      expect(raw).toContain("github.event.pull_request.head.repo.full_name");
      expect(raw).toContain("github.repository");
      expect(countOccurrences(raw, "pnpm exec a11yst audit")).toBe(1);
    });

    it("runs the final gate after uploads and treats SARIF upload failure as operational", () => {
      const job = getGitHubJob(doc);
      const steps = job.steps as Array<Record<string, unknown>>;
      const names = steps.map((step) => step.name);
      const uploadIndex = names.indexOf("Upload a11yst SARIF to GitHub Code Scanning");
      const gateIndex = names.indexOf("Apply a11yst result");
      expect(uploadIndex).toBeGreaterThan(-1);
      expect(gateIndex).toBeGreaterThan(uploadIndex);
      expect(raw).toContain("SARIF_UPLOAD_OUTCOME");
      expect(raw).toContain('if [ "$SARIF_UPLOAD_OUTCOME" = "failure" ]; then');
    });
  });
});
