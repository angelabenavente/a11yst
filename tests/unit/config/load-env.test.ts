import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";

describe("loadConfig environment re-evaluation", () => {
  const previousPort = process.env.A11YST_TEST_CONFIG_PORT;

  afterEach(() => {
    if (previousPort === undefined) {
      delete process.env.A11YST_TEST_CONFIG_PORT;
    } else {
      process.env.A11YST_TEST_CONFIG_PORT = previousPort;
    }
  });

  it("re-reads process.env on each loadConfig call", async () => {
    const dir = await mkdtemp(join(tmpdir(), "a11yst-config-env-"));
    await writeFile(
      join(dir, "a11yst.config.ts"),
      `const port = process.env.A11YST_TEST_CONFIG_PORT ?? "3000";
export default {
  projects: [{
    name: "env-port",
    platform: "web",
    baseUrl: \`http://127.0.0.1:\${port}\`,
    routes: ["/"],
  }],
};`,
      "utf8",
    );

    process.env.A11YST_TEST_CONFIG_PORT = "4101";
    const first = await loadConfig({ cwd: dir });
    expect(first.projects[0]?.platform).toBe("web");
    if (first.projects[0]?.platform !== "web") return;
    expect(first.projects[0].baseUrl).toBe("http://127.0.0.1:4101");

    process.env.A11YST_TEST_CONFIG_PORT = "4102";
    const second = await loadConfig({ cwd: dir });
    expect(second.projects[0]?.platform).toBe("web");
    if (second.projects[0]?.platform !== "web") return;
    expect(second.projects[0].baseUrl).toBe("http://127.0.0.1:4102");
  });
});
