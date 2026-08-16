import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getRepoRoot } from "../../helpers/release/workspace-packages.js";

/** Intentional baseline fixtures checked in for example-driven baseline tests. */
const ALLOWED_TRACKED_A11YST = /^examples\/baseline\/[^/]+\/.a11yst\/baseline\.json$/;

const GENERATED_ARTIFACT_PATTERNS = [
  /\/\.a11yst\/results\//,
  /\/\.allyst-out\//,
  /\/\.a11yst-out\//,
  /\/latest\.json$/,
  /\/results\/runs\/[^/]+\/report\//,
  /\.sarif$/,
  /\.junit\.xml$/,
  /\/results\/runs\/[^/]+\/evidence\/.*\.png$/,
  /\/results\/runs\/[^/]+\/results\.json$/,
  /demo-summary\.md$/,
  /\.tgz$/,
] as const;

function listTrackedFiles(repoRoot: string): string[] {
  return execSync("git ls-files", { cwd: repoRoot, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

describe("repository hygiene", () => {
  it("does not track legacy .allyst artifact directories", () => {
    const tracked = listTrackedFiles(getRepoRoot());
    const legacy = tracked.filter((path) => /(^|\/)\.allyst(\/|$)/.test(path));
    expect(legacy).toEqual([]);
  });

  it("tracks .a11yst paths only as intentional baseline fixtures", () => {
    const tracked = listTrackedFiles(getRepoRoot());
    const a11ystPaths = tracked.filter((path) => /(^|\/)\.a11yst(\/|$)/.test(path));
    const unexpected = a11ystPaths.filter((path) => !ALLOWED_TRACKED_A11YST.test(path));
    expect(unexpected).toEqual([]);
  });

  it("does not track generated runtime artifacts or tarballs", () => {
    const tracked = listTrackedFiles(getRepoRoot());
    const generated = tracked.filter((path) =>
      GENERATED_ARTIFACT_PATTERNS.some((pattern) => pattern.test(path)),
    );
    expect(generated).toEqual([]);
  });

  it("does not track example build output directories", () => {
    const tracked = listTrackedFiles(getRepoRoot());
    const exampleBuilds = tracked.filter((path) => /^examples\/.+\/dist\//.test(path));
    expect(exampleBuilds).toEqual([]);
  });

  it("does not track demo generated audit output", () => {
    const tracked = listTrackedFiles(getRepoRoot());
    const demoArtifacts = tracked.filter(
      (path) =>
        path.startsWith("examples/demo/") &&
        (/\/\.a11yst\//.test(path) || /\/\.allyst\//.test(path)),
    );
    expect(demoArtifacts).toEqual([]);
  });
});
