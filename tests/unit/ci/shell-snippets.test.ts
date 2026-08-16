import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CI_PATHS,
  collectRunScripts,
  parseTemplate,
  readTemplate,
} from "./helpers.js";

const bashAvailable = (() => {
  try {
    execFileSync("bash", ["-n", "/dev/null"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("CI template shell snippets", () => {
  const templatePaths = [
    CI_PATHS.githubBase,
    CI_PATHS.githubCodeScanning,
    CI_PATHS.gitlab,
  ];

  for (const path of templatePaths) {
    describe(path.split("/").slice(-2).join("/"), () => {
      const scripts = collectRunScripts(parseTemplate(path));

      it("extracts at least one multiline shell block", () => {
        expect(scripts.length).toBeGreaterThan(0);
      });

      if (bashAvailable) {
        for (const [index, script] of scripts.entries()) {
          it(`script block ${index + 1} passes bash -n`, () => {
            const dir = mkdtempSync(join(tmpdir(), "a11yst-ci-shell-"));
            const file = join(dir, "script.sh");
            writeFileSync(file, script, "utf8");
            expect(() =>
              execFileSync("bash", ["-n", file], { stdio: "pipe" }),
            ).not.toThrow();
          });
        }
      }

      it("captures audit status with set +e and immediate $?", () => {
        const auditScript = scripts.find((script) => script.includes("a11yst audit"));
        expect(auditScript).toBeDefined();
        expect(auditScript).toContain("set +e");
        expect(auditScript).toMatch(/status=\$\?/);
        expect(auditScript).toContain("set -e");
      });

      it("does not use eval, source on annotations, curl, wget, or machine-specific absolute paths", () => {
        const combined = scripts.join("\n");
        expect(combined).not.toMatch(/\beval\b/);
        expect(combined).not.toMatch(/\bsource\b.*github-annotations/);
        expect(combined).not.toContain("curl ");
        expect(combined).not.toContain("wget ");
        expect(combined).not.toMatch(/\/Users\//);
        expect(combined).not.toMatch(/ghp_[A-Za-z0-9]+/);
      });
    });
  }

  it("GitHub annotation step uses cat only", () => {
    const raw = readTemplate(CI_PATHS.githubBase);
    expect(raw).toContain("cat .a11yst/ci/github-annotations.txt");
    expect(raw).not.toContain("source .a11yst/ci/github-annotations.txt");
  });

  it("GitHub gate uses quoted env variables", () => {
    const raw = readTemplate(CI_PATHS.githubBase);
    expect(raw).toContain('case "$A11YST_EXIT_CODE" in');
  });
});
