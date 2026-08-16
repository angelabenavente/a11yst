/**
 * @param {ReturnType<import('./summary.mjs').createDemoSummary>} summary
 * @param {ReturnType<import('./paths.mjs').resolveReportLocations>} reportLocations
 */
export function renderDemoSummaryMarkdown(summary, reportLocations) {
  const lines = [
    "# a11yst demo summary",
    "",
    "Automated accessibility testing does not establish WCAG conformance and does not replace manual accessibility testing.",
    "",
    "## Audit comparison",
    "",
    "| Status | Count |",
    "| --- | ---: |",
    `| Known | ${summary.findings.known} |`,
    `| New | ${summary.findings.new} |`,
    `| Regressed | ${summary.findings.regressed} |`,
    `| Resolved | ${summary.findings.resolved} |`,
    `| Not compared | ${summary.findings.notCompared} |`,
    "",
    "## Interactive coverage",
    "",
    `Flow/checkpoint findings: ${summary.findings.interactive}`,
    "",
    "## Source analysis",
    "",
    `- Mapped: ${summary.sourceAnalysis.mapped}`,
    `- Ambiguous: ${summary.sourceAnalysis.ambiguous}`,
    `- Unmapped: ${summary.sourceAnalysis.unmapped}`,
    `- Invalid: ${summary.sourceAnalysis.invalid}`,
    "",
    "## Recommendations",
    "",
    `Findings with recommendations: ${summary.recommendations.findingsWithRecommendations}`,
    "",
    "Recommendations are review guidance, not automatic fixes.",
    "",
    "## Policy",
    "",
    `- Current audit exit: ${summary.policy.exitCode}`,
    `- Configured policy breach: ${summary.policy.breached ? "yes" : "no"}`,
    "",
    "The configured accessibility policy detected new findings that require review when a breach is reported.",
    "",
    "## Reports",
    "",
  ];

  if (reportLocations.html) {
    lines.push(`- HTML: ${reportLocations.html}`);
  }
  if (reportLocations.json) {
    lines.push(`- JSON: ${reportLocations.json}`);
  }
  if (reportLocations.sarif) {
    lines.push(`- SARIF: ${reportLocations.sarif}`);
  }
  if (reportLocations.junit) {
    lines.push(`- JUnit: ${reportLocations.junit}`);
  }
  if (reportLocations.markdown) {
    lines.push(`- Markdown: ${reportLocations.markdown}`);
  }
  if (reportLocations.githubAnnotations) {
    lines.push(`- GitHub annotations: ${reportLocations.githubAnnotations}`);
  }
  if (reportLocations.demoSummary) {
    lines.push(`- Demo summary: ${reportLocations.demoSummary}`);
  }

  lines.push("");
  return `${lines.join("\n")}`;
}
