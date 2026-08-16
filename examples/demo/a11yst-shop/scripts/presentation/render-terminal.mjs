function padLabel(label, width = 22) {
  return `${label}${" ".repeat(Math.max(1, width - label.length))}`;
}

/**
 * @param {ReturnType<import('./summary.mjs').createDemoSummary>} summary
 * @param {ReturnType<import('./paths.mjs').resolveReportLocations>} reportLocations
 */
export function renderDemoSummary(summary, reportLocations) {
  const lines = [
    "",
    "Comparison",
    "",
    `${padLabel("Known findings:")}${summary.findings.known}`,
    `${padLabel("New findings:")}${summary.findings.new}`,
    `${padLabel("Regressed findings:")}${summary.findings.regressed}`,
    `${padLabel("Resolved findings:")}${summary.findings.resolved}`,
    `${padLabel("Not compared:")}${summary.findings.notCompared}`,
    `${padLabel("Interactive findings:")}${summary.findings.interactive}`,
    "",
    "Source analysis",
    "",
    `${padLabel("Mapped:")}${summary.sourceAnalysis.mapped}`,
    `${padLabel("Ambiguous:")}${summary.sourceAnalysis.ambiguous}`,
    `${padLabel("Unmapped:")}${summary.sourceAnalysis.unmapped}`,
    `${padLabel("Invalid:")}${summary.sourceAnalysis.invalid}`,
    "",
    "Recommendations",
    "",
    `${padLabel("Findings with recommendations:")}${summary.recommendations.findingsWithRecommendations}`,
    "",
    "Policy",
    "",
    `${padLabel("Current audit exit:")}${summary.policy.exitCode}`,
    `${padLabel("Configured policy breach:")}${summary.policy.breached ? "yes" : "no"}`,
    "",
    "Reports",
    "",
  ];

  if (reportLocations.html) {
    lines.push(`${padLabel("HTML:")}${reportLocations.html}`);
  }
  if (reportLocations.json) {
    lines.push(`${padLabel("JSON:")}${reportLocations.json}`);
  }
  if (reportLocations.sarif) {
    lines.push(`${padLabel("SARIF:")}${reportLocations.sarif}`);
  }
  if (reportLocations.junit) {
    lines.push(`${padLabel("JUnit:")}${reportLocations.junit}`);
  }
  if (reportLocations.markdown) {
    lines.push(`${padLabel("Markdown:")}${reportLocations.markdown}`);
  }
  if (reportLocations.githubAnnotations) {
    lines.push(`${padLabel("GitHub annotations:")}${reportLocations.githubAnnotations}`);
  }
  if (reportLocations.demoSummary) {
    lines.push(`${padLabel("Demo summary:")}${reportLocations.demoSummary}`);
  }

  lines.push("", "Demo complete.", "");
  return `${lines.join("\n")}`;
}

/**
 * @param {string} stageLabel
 */
export function renderStageProgress(stageLabel) {
  return `${stageLabel}\n`;
}

export function renderDemoHeader() {
  return ["a11yst DEMO", "Accessibility regression showcase", ""].join("\n");
}
