import {
  createArtifactWriter,
  createAuditId,
  sanitizePathSegment,
  stableStringify,
} from "@a11yst/artifacts";
import type { AuditExecutionResult, AuditManifest } from "@a11yst/types";
import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const now = new Date("2026-08-03T18:25:01.234Z");

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "a11yst-artifacts-"));
  temporaryDirectories.push(directory);
  return directory;
}

function makeResult(): AuditExecutionResult {
  return {
    schemaVersion: "1",
    status: "completed",
    summary: {
      status: "completed",
      startedAt: now.toISOString(),
      durationMs: 1,
      plannedRuns: 0,
      completedRuns: 0,
      skippedRuns: 0,
      failedRuns: 0,
      findingCount: 0,
      findingsBySeverity: {
        minor: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
    },
    plan: {
      projects: [],
      runs: [],
      totalRuns: 0,
      diagnostics: [],
      createdAt: now.toISOString(),
    },
    runs: [],
    findings: [],
    diagnostics: [],
    limitations: [],
    environment: {
      product: "a11yst",
      productVersion: "1.0.0",
      nodeVersion: process.version,
      headed: false,
    },
  };
}

function makeManifest(auditId: string): AuditManifest {
  return {
    schemaVersion: "1",
    auditId,
    createdAt: now.toISOString(),
    status: "passed",
    productVersion: "1.0.0",
    projectRoot: ".",
    resultsPath: "results.json",
    reportPath: "report/index.html",
    evidenceDirectory: "evidence",
    projects: [],
    artifactCounts: { screenshots: 0, findings: 0, runs: 0 },
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("createAuditId", () => {
  it("creates a deterministic compact UTC id when entropy is injected", () => {
    const first = createAuditId({ now, entropy: "test-seed" });
    const second = createAuditId({ now, entropy: "test-seed" });

    expect(first).toBe(second);
    expect(first).toMatch(/^20260803T182501234Z-[a-f0-9]{8}$/);
  });

  it("does not collide in consecutive default calls", () => {
    const ids = Array.from({ length: 100 }, () => createAuditId());
    expect(new Set(ids)).toHaveLength(ids.length);
  });
});

describe("sanitizePathSegment", () => {
  it("keeps portable unicode and simple names readable", () => {
    expect(sanitizePathSegment("résumé")).toBe("résumé");
    expect(sanitizePathSegment("desktop")).toBe("desktop");
  });

  it.each([
    "hello world",
    "route/to/page",
    String.raw`route\to\page`,
    "../../secret",
    String.raw`C:\Windows\system32`,
    "#app > button[aria-label='Save']",
    "CON",
    ".",
    "..",
  ])("makes %j a safe single segment", (input) => {
    const sanitized = sanitizePathSegment(input);
    expect(sanitized).not.toBe(".");
    expect(sanitized).not.toBe("..");
    expect(sanitized).not.toMatch(/[<>:"/\\|?*%]/);
    expect(
      Array.from(sanitized).every((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint > 31 && codePoint !== 127;
      }),
    ).toBe(true);
    expect(sanitized.length).toBeGreaterThan(0);
  });

  it("adds hashes for normalization collisions and truncation", () => {
    expect(sanitizePathSegment("a/b")).not.toBe(sanitizePathSegment("a\\b"));
    const long = sanitizePathSegment("x".repeat(400), { maxLength: 32 });
    expect(long).toHaveLength(32);
    expect(long).toMatch(/-[a-f0-9]{8}$/);
  });

  it("preserves file extensions while disambiguating unsafe names", () => {
    expect(sanitizePathSegment("element screenshot.png")).toMatch(
      /^element-screenshot-[a-f0-9]{8}\.png$/,
    );
  });
});

describe("stableStringify", () => {
  it("sorts object keys recursively, preserves arrays, and ends with a newline", () => {
    expect(stableStringify({ z: 1, nested: { b: 2, a: 1 }, list: [3, 1] })).toBe(
      '{\n  "list": [\n    3,\n    1\n  ],\n  "nested": {\n    "a": 1,\n    "b": 2\n  },\n  "z": 1\n}\n',
    );
  });

  it("reports unsupported and circular values with their location", () => {
    expect(() => stableStringify({ nested: { value: undefined } })).toThrow(
      "$.nested.value",
    );
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(() => stableStringify(circular)).toThrow("circular reference at $.self");
  });
});

describe("ArtifactWriter", () => {
  it("creates existing output directories and resolves POSIX bundle paths", async () => {
    const outputDir = await makeTemporaryDirectory();
    await mkdir(join(outputDir, "runs"), { recursive: true });
    const writer = createArtifactWriter({ outputDir, now, auditId: "run-one" });

    expect(writer.auditId).toBe("run-one");
    expect(writer.outputDir).toBe(await realpath(outputDir));
    expect(writer.relativePath("evidence", "project", "shot.png")).toBe(
      "evidence/project/shot.png",
    );
    expect(writer.resolveBundlePath("manifest.json")).toBe(
      join(writer.runDirectory, "manifest.json"),
    );
    expect((await lstat(writer.runDirectory)).isDirectory()).toBe(true);
  });

  it.each([
    "../outside.json",
    "safe/../../outside.json",
    "/absolute.json",
    String.raw`C:\absolute.json`,
    String.raw`safe\..\outside.json`,
    "%2e%2e/outside.json",
    "safe/%2Foutside.json",
    "report/CON",
    "report/trailing.",
  ])("rejects unsafe bundle path %j", async (unsafePath) => {
    const outputDir = await makeTemporaryDirectory();
    const writer = createArtifactWriter({ outputDir, auditId: "safe-run" });

    expect(() => writer.resolveBundlePath(unsafePath)).toThrow();
    await expect(writer.writeJson(unsafePath, {})).rejects.toThrow();
  });

  it("rejects existing symbolic-link path segments", async () => {
    const outputDir = await makeTemporaryDirectory();
    const outside = await makeTemporaryDirectory();
    const writer = createArtifactWriter({ outputDir, auditId: "safe-run" });
    await symlink(outside, join(writer.runDirectory, "linked"));

    expect(() => writer.resolveBundlePath("linked/escape.json")).toThrow(
      "Symbolic links",
    );
    await expect(writer.writeJson("linked/escape.json", {})).rejects.toThrow();
  });

  it("writes JSON and buffers atomically without temporary residue", async () => {
    const outputDir = await makeTemporaryDirectory();
    const writer = createArtifactWriter({ outputDir, auditId: "atomic-run" });

    await writer.writeJson("nested/data.json", { z: 2, a: 1 });
    await writer.writeBuffer("nested/raw.bin", Buffer.from([1, 2, 3]));

    expect(await readFile(join(writer.runDirectory, "nested/data.json"), "utf8")).toBe(
      '{\n  "a": 1,\n  "z": 2\n}\n',
    );
    expect(await readFile(join(writer.runDirectory, "nested/raw.bin"))).toEqual(
      Buffer.from([1, 2, 3]),
    );
    expect((await readdir(join(writer.runDirectory, "nested"))).every(
      (name) => !name.endsWith(".tmp"),
    )).toBe(true);
  });

  it("writes safe evidence and report paths without exposing full selectors", async () => {
    const outputDir = await makeTemporaryDirectory();
    const writer = createArtifactWriter({ outputDir, auditId: "evidence-run" });
    const selector = "#app > main/button[aria-label='Save']";

    const evidencePath = await writer.writeEvidence({
      projectName: "Web App",
      routeId: "../../settings",
      profile: "keyboard/default",
      viewportName: "Windows\\Desktop",
      filename: `${selector}.png`,
      data: Buffer.from("png"),
    });
    const reportPath = await writer.writeReportAsset("assets/app.js", "console.log(1)");

    expect(evidencePath).toMatch(
      /^evidence\/Web-App-[a-f0-9]{8}\/settings-[a-f0-9]{8}\/keyboard-default-[a-f0-9]{8}\/Windows-Desktop-[a-f0-9]{8}\/[^/]+\.png$/,
    );
    expect(evidencePath).not.toContain(selector);
    expect(reportPath).toBe("report/assets/app.js");
    expect(writer.screenshotCount).toBe(1);
    expect(await readFile(writer.resolveBundlePath(evidencePath), "utf8")).toBe("png");
  });

  it("finalizes results, manifest, and the stable latest pointer", async () => {
    const outputDir = await makeTemporaryDirectory();
    const writer = createArtifactWriter({ outputDir, auditId: "final-run", now });
    const result = makeResult();
    const manifest = makeManifest(writer.auditId);
    await writer.writeReportAsset("index.html", "<h1>Report</h1>");

    const references = await writer.finalize({ result, manifest });
    const latest = JSON.parse(
      await readFile(join(outputDir, "latest.json"), "utf8"),
    ) as Record<string, unknown>;

    expect(JSON.parse(await readFile(references.resultsPath, "utf8"))).toEqual(result);
    expect(JSON.parse(await readFile(references.manifestPath, "utf8"))).toEqual(
      manifest,
    );
    expect(latest).toEqual({
      auditId: "final-run",
      createdAt: now.toISOString(),
      manifestPath: "runs/final-run/manifest.json",
      reportPath: "runs/final-run/report/index.html",
      resultsPath: "runs/final-run/results.json",
      schemaVersion: "1",
    });
    expect(references).toEqual({
      outputDirectory: writer.runDirectory,
      manifestPath: join(writer.runDirectory, "manifest.json"),
      resultsPath: join(writer.runDirectory, "results.json"),
      reportPath: join(writer.runDirectory, "report/index.html"),
      evidenceDirectory: join(writer.runDirectory, "evidence"),
      latestPath: join(writer.outputDir, "latest.json"),
    });
    expect((await readdir(outputDir)).every((name) => !name.endsWith(".tmp"))).toBe(
      true,
    );
  });

  it("cleans only its own run and remains idempotent", async () => {
    const outputDir = await makeTemporaryDirectory();
    const first = createArtifactWriter({ outputDir, auditId: "first" });
    const second = createArtifactWriter({ outputDir, auditId: "second" });
    await first.writeJson("partial.json", { partial: true });
    await second.writeJson("keep.json", { keep: true });
    await writeFile(join(outputDir, "root-file.txt"), "keep");

    await first.cleanupPartial();
    await first.cleanupPartial();

    await expect(lstat(first.runDirectory)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(second.runDirectory, "keep.json"), "utf8")).toContain(
      '"keep": true',
    );
    expect(await readFile(join(outputDir, "root-file.txt"), "utf8")).toBe("keep");
  });
});
