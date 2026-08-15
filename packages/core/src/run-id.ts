/**
 * Build a deterministic, stable identifier for a planned run.
 * Same inputs always produce the same id.
 */
export function buildRunId(parts: {
  projectName: string;
  platform: string;
  framework: string;
  profile: string;
  routePath?: string;
  viewportName?: string;
}): string {
  const segments = [
    parts.platform,
    parts.projectName,
    parts.framework,
    parts.profile,
  ];

  if (parts.routePath !== undefined) {
    segments.push(parts.routePath === "/" ? "root" : parts.routePath);
  }
  if (parts.viewportName !== undefined) {
    segments.push(parts.viewportName);
  }

  return segments
    .map((segment) =>
      segment
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join("::");
}
