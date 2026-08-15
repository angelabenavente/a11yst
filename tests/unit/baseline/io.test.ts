import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BaselineConcurrentModificationError,
  BaselineReadError,
  loadBaselineFile,
  readBaselineFileState,
  resolveBaselinePath,
  writeBaselineFile,
} from "@a11yst/baseline";
import { baselineEntry, baselineFile, FIXED_NOW } from "./fixtures.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempBaselineDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "a11yst-baseline-io-"));
  tempDirs.push(dir);
  return dir;
}

describe("baseline io", () => {
  it("writes baseline atomically without leaving temp files", async () => {
    const dir = await tempBaselineDir();
    const filePath = join(dir, ".a11yst", "baseline.json");
    const baseline = baselineFile({
      entries: [baselineEntry()],
    });

    await writeBaselineFile(filePath, baseline);

    const files = await readdir(join(dir, ".a11yst"));
    expect(files).toEqual(["baseline.json"]);
    expect(files.some((name) => name.endsWith(".tmp"))).toBe(false);

    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    expect(parsed.schemaVersion).toBe("1");
    expect(parsed.entries).toHaveLength(1);
    expect(content.endsWith("\n")).toBe(true);
  });

  it("loads and validates a written baseline file", async () => {
    const dir = await tempBaselineDir();
    const filePath = join(dir, "baseline.json");
    const baseline = baselineFile({ entries: [baselineEntry({ fingerprint: "load-fp" })] });

    await writeBaselineFile(filePath, baseline);
    const loaded = await loadBaselineFile(filePath);

    expect(loaded.entries[0]?.fingerprint).toBe("load-fp");
    expect(loaded.updatedAt).toBe(FIXED_NOW);
  });

  it("throws BaselineReadError when baseline file is missing", async () => {
    const dir = await tempBaselineDir();
    await expect(loadBaselineFile(join(dir, "missing.json"))).rejects.toThrow(BaselineReadError);
  });

  it("detects concurrent modification via expectedHash", async () => {
    const dir = await tempBaselineDir();
    const filePath = join(dir, "baseline.json");
    const baseline = baselineFile({ entries: [baselineEntry()] });

    await writeBaselineFile(filePath, baseline);
    const state = await readBaselineFileState(filePath);

    await writeFile(filePath, `${state.content}\n`, "utf8");

    await expect(
      writeBaselineFile(filePath, baseline, { expectedHash: state.hash }),
    ).rejects.toThrow(BaselineConcurrentModificationError);
  });

  it("detects concurrent modification via expectedMtimeMs", async () => {
    const dir = await tempBaselineDir();
    const filePath = join(dir, "baseline.json");
    const baseline = baselineFile({ entries: [baselineEntry()] });

    await writeBaselineFile(filePath, baseline);
    const state = await readBaselineFileState(filePath);

    await writeFile(
      filePath,
      JSON.stringify({ ...baseline, updatedAt: "2026-01-01T00:00:00.000Z" }, null, 2),
      "utf8",
    );

    await expect(
      writeBaselineFile(filePath, baseline, { expectedMtimeMs: state.mtimeMs }),
    ).rejects.toThrow(BaselineConcurrentModificationError);
  });

  it("resolves baseline paths relative to config directory", () => {
    const configDir = "/workspace/project";
    expect(resolveBaselinePath(configDir, ".a11yst/baseline.json")).toBe(
      "/workspace/project/.a11yst/baseline.json",
    );
  });

  it("rejects baseline paths that escape the config directory", () => {
    expect(() => resolveBaselinePath("/workspace/project", "../outside.json")).toThrow(
      BaselineReadError,
    );
  });
});
