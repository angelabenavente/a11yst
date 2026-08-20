import { spawnSync } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const audit = spawnSync(pnpm, ["audit", "--prod", "--json"], {
  cwd: process.cwd(),
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

if (audit.error) {
  throw audit.error;
}

if (audit.status !== 0 && audit.status !== 1) {
  process.stderr.write(audit.stderr);
  throw new Error(`pnpm audit failed with exit code ${audit.status ?? "unknown"}.`);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch (error) {
  process.stderr.write(audit.stderr);
  throw new Error("pnpm audit did not return valid JSON.", { cause: error });
}

const advisories = Object.values(report.advisories ?? {});
const publishedAdvisories = advisories.flatMap((advisory) => {
  const publishedPaths = (advisory.findings ?? [])
    .flatMap((finding) => finding.paths ?? [])
    .filter((path) => path.startsWith("packages/"));
  return publishedPaths.length > 0 ? [{ advisory, publishedPaths }] : [];
});

if (publishedAdvisories.length === 0) {
  const ignored = advisories.length;
  process.stdout.write(
    `Published dependency audit passed.${ignored > 0 ? ` ${ignored} workspace advisories are confined to non-published examples.` : ""}\n`,
  );
  process.exitCode = 0;
} else {
  process.stderr.write(
    `Published dependency audit found ${publishedAdvisories.length} vulnerable ${publishedAdvisories.length === 1 ? "advisory" : "advisories"}:\n`,
  );
  for (const { advisory, publishedPaths } of publishedAdvisories) {
    const id = advisory.github_advisory_id ?? advisory.id ?? "unknown";
    process.stderr.write(
      `- ${id} [${advisory.severity ?? "unknown"}] ${advisory.module_name ?? "unknown package"}: ${advisory.title ?? "untitled advisory"}\n`,
    );
    for (const path of publishedPaths) {
      process.stderr.write(`  ${path}\n`);
    }
  }
  process.exitCode = 1;
}
