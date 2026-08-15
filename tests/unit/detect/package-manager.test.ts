import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectPackageManager, LOCKFILE_PRIORITY } from "@a11yst/detect";
import { withTempDir } from "../../helpers/cli.js";

async function touch(dir: string, name: string): Promise<void> {
  await writeFile(join(dir, name), "", "utf8");
}

describe("@a11yst/detect detectPackageManager", () => {
  it("detects pnpm via pnpm-lock.yaml", async () => {
    await withTempDir("pm-pnpm-", async (dir) => {
      await touch(dir, "pnpm-lock.yaml");
      const result = detectPackageManager(dir, undefined);
      expect(result.name).toBe("pnpm");
      expect(result.confidence).toBe("high");
      expect(result.diagnostics).toHaveLength(0);
      expect(result.evidence.some((e) => e.value === "pnpm-lock.yaml")).toBe(true);
    });
  });

  it("detects npm via package-lock.json", async () => {
    await withTempDir("pm-npm-", async (dir) => {
      await touch(dir, "package-lock.json");
      const result = detectPackageManager(dir, undefined);
      expect(result.name).toBe("npm");
      expect(result.confidence).toBe("high");
      expect(result.evidence.some((e) => e.value === "package-lock.json")).toBe(true);
    });
  });

  it("detects yarn via yarn.lock", async () => {
    await withTempDir("pm-yarn-", async (dir) => {
      await touch(dir, "yarn.lock");
      const result = detectPackageManager(dir, undefined);
      expect(result.name).toBe("yarn");
      expect(result.confidence).toBe("high");
    });
  });

  it("detects bun via bun.lockb", async () => {
    await withTempDir("pm-bunb-", async (dir) => {
      await touch(dir, "bun.lockb");
      const result = detectPackageManager(dir, undefined);
      expect(result.name).toBe("bun");
      expect(result.confidence).toBe("high");
    });
  });

  it("detects bun via bun.lock", async () => {
    await withTempDir("pm-bun-", async (dir) => {
      await touch(dir, "bun.lock");
      const result = detectPackageManager(dir, undefined);
      expect(result.name).toBe("bun");
      expect(result.confidence).toBe("high");
    });
  });

  it("prefers the packageManager field in package.json when no lockfile is present", async () => {
    await withTempDir("pm-field-", async (dir) => {
      const result = detectPackageManager(dir, { packageManager: "pnpm@9.15.0" });
      expect(result.name).toBe("pnpm");
      expect(result.confidence).toBe("high");
      expect(result.diagnostics).toHaveLength(0);
      expect(
        result.evidence.some((e) => e.type === "configuration" && e.value === "pnpm@9.15.0"),
      ).toBe(true);
    });
  });

  it("reaches certain confidence when packageManager field and lockfile agree", async () => {
    await withTempDir("pm-agree-", async (dir) => {
      await touch(dir, "pnpm-lock.yaml");
      const result = detectPackageManager(dir, { packageManager: "pnpm@9.15.0" });
      expect(result.name).toBe("pnpm");
      expect(result.confidence).toBe("certain");
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  it("resolves contradictory signals deterministically and reports a diagnostic (field vs lockfile)", async () => {
    await withTempDir("pm-conflict-field-", async (dir) => {
      await touch(dir, "pnpm-lock.yaml");
      const result = detectPackageManager(dir, { packageManager: "npm@10.0.0" });
      // packageManager field takes priority over lockfiles.
      expect(result.name).toBe("npm");
      expect(result.confidence).toBe("high");
      expect(result.diagnostics.some((d) => d.code === "PACKAGE_MANAGER_CONFLICT")).toBe(true);
    });
  });

  it("resolves contradictory lockfiles deterministically using pnpm > yarn > bun > npm priority", async () => {
    await withTempDir("pm-conflict-locks-", async (dir) => {
      await touch(dir, "pnpm-lock.yaml");
      await touch(dir, "yarn.lock");
      const resultA = detectPackageManager(dir, undefined);
      const resultB = detectPackageManager(dir, undefined);
      expect(resultA.name).toBe("pnpm");
      expect(resultA.name).toBe(resultB.name);
      expect(resultA.confidence).toBe("medium");
      expect(resultA.diagnostics.some((d) => d.code === "PACKAGE_MANAGER_CONFLICT")).toBe(true);
    });
  });

  it("picks bun over npm when both lockfiles are present, matching LOCKFILE_PRIORITY", async () => {
    await withTempDir("pm-conflict-bun-npm-", async (dir) => {
      await touch(dir, "bun.lock");
      await touch(dir, "package-lock.json");
      const result = detectPackageManager(dir, undefined);
      expect(result.name).toBe("bun");
      expect(LOCKFILE_PRIORITY.indexOf("bun")).toBeLessThan(LOCKFILE_PRIORITY.indexOf("npm"));
    });
  });

  it("returns unknown with a diagnostic when there are no signals at all", async () => {
    await withTempDir("pm-none-", async (dir) => {
      const result = detectPackageManager(dir, undefined);
      expect(result.name).toBe("unknown");
      expect(result.confidence).toBe("unknown");
      expect(result.evidence).toHaveLength(0);
      expect(result.diagnostics.some((d) => d.code === "PACKAGE_MANAGER_UNKNOWN")).toBe(true);
    });
  });

  it("falls back to lockfile detection and warns when the packageManager field is unrecognized", async () => {
    await withTempDir("pm-bad-field-", async (dir) => {
      await touch(dir, "yarn.lock");
      const result = detectPackageManager(dir, { packageManager: "foo@1.0.0" });
      expect(result.name).toBe("yarn");
      expect(
        result.diagnostics.some((d) => d.code === "PACKAGE_MANAGER_FIELD_UNRECOGNIZED"),
      ).toBe(true);
    });
  });

  it("is deterministic across repeated calls", async () => {
    await withTempDir("pm-deterministic-", async (dir) => {
      await touch(dir, "pnpm-lock.yaml");
      await touch(dir, "yarn.lock");
      const a = detectPackageManager(dir, { packageManager: "bun@1.1.0" });
      const b = detectPackageManager(dir, { packageManager: "bun@1.1.0" });
      expect(a.name).toEqual(b.name);
      expect(a.confidence).toEqual(b.confidence);
      expect(a.evidence).toEqual(b.evidence);
    });
  });
});
