import { join, relative, resolve } from "node:path";

/**
 * @param {string} demoRoot Absolute demo root directory.
 * @param {string} runDir Absolute run output directory.
 * @param {import('@a11yst/types').AuditExecutionResult} results
 */
export function resolveReportLocations(demoRoot, runDir, results) {
  const artifacts = results.artifacts ?? {};
  const runRelative = relative(demoRoot, runDir).split("\\").join("/");

  function artifactPath(relativePath) {
    if (!relativePath) {
      return undefined;
    }
    return join(runRelative, relativePath).split("\\").join("/");
  }

  return {
    json: artifactPath(artifacts.resultsPath ?? "results.json"),
    html: artifactPath(artifacts.reportPath),
    sarif: artifactPath(artifacts.sarifPath),
    junit: artifactPath(artifacts.junitPath),
    markdown: artifactPath(artifacts.markdownPath),
    githubAnnotations: artifactPath(artifacts.githubAnnotationsPath),
    demoSummary: ".a11yst/demo/demo-summary.md",
  };
}

/**
 * Confine cleanup to the demo `.a11yst` output directory.
 * @param {string} demoRoot
 */
export function resolveDemoOutputRoot(demoRoot) {
  const outputRoot = resolve(demoRoot, ".a11yst");
  const normalizedDemoRoot = resolve(demoRoot);

  if (outputRoot === normalizedDemoRoot) {
    throw new Error("Demo failed: refused to clean demo source root.");
  }

  if (!outputRoot.startsWith(`${normalizedDemoRoot}/`)) {
    throw new Error("Demo failed: output directory escapes demo root.");
  }

  return outputRoot;
}
