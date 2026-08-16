import { describe, expect, it } from "vitest";
import {
  EXPECTED_LOCATIONS,
  REAL_MONOREPO_ROOT,
  findingBuilders,
  runRealAnalysis,
  expectMappedLocation,
  serializedSafe,
} from "./fixtures.js";

describe("route-aware Next and Nuxt fixtures", () => {
  it("maps Next checkout route targets without using loading-only files", async () => {
    const result = await runRealAnalysis(
      [
        findingBuilders.nextCheckoutMapped(),
        findingBuilders.nextSharedAmbiguous(),
        findingBuilders.nextLoadingUnmapped(),
      ],
      { ranking: false, recommendations: false },
    );

    expectMappedLocation(result.findings.find((f) => f.id === "next-checkout"), EXPECTED_LOCATIONS.nextCheckout, "high");
    const shared = result.findings.find((f) => f.id === "next-shared");
    expect(shared?.sourceMapping?.status).toBe("ambiguous");
    expect(shared?.sourceMapping?.selected).toBeUndefined();
    const uris = shared?.sourceMapping?.candidates.map((c) => c.location.uri) ?? [];
    expect(uris).toContain(EXPECTED_LOCATIONS.nextLayoutShared.uri);
    expect(uris).toContain(EXPECTED_LOCATIONS.nextPageShared.uri);
    expect(result.findings.find((f) => f.id === "next-loading")?.sourceMapping?.status).toBe("unmapped");

    const serialized = serializedSafe(result);
    expect(serialized).not.toContain(".next");
    expect(serialized).not.toContain(EXPECTED_LOCATIONS.nextCheckout.uri.split("/").pop() + "?step");
  });

  it("maps Nuxt checkout route targets and preserves layout/page ambiguity", async () => {
    const result = await runRealAnalysis(
      [findingBuilders.nuxtCheckoutMapped(), findingBuilders.nuxtSharedAmbiguous()],
      { ranking: false, recommendations: false },
    );

    expectMappedLocation(result.findings.find((f) => f.id === "nuxt-checkout"), EXPECTED_LOCATIONS.nuxtCheckout, "high");
    const shared = result.findings.find((f) => f.id === "nuxt-shared");
    expect(shared?.sourceMapping?.status).toBe("ambiguous");
    expect(shared?.sourceMapping?.selected).toBeUndefined();
    const uris = shared?.sourceMapping?.candidates.map((c) => c.location.uri) ?? [];
    expect(uris).toContain(EXPECTED_LOCATIONS.nuxtLayoutShared.uri);
    expect(uris).toContain(EXPECTED_LOCATIONS.nuxtPageShared.uri);

    const serialized = serializedSafe(result);
    expect(serialized).not.toContain(".nuxt");
    expect(serialized).not.toContain(REAL_MONOREPO_ROOT);
  });
});
