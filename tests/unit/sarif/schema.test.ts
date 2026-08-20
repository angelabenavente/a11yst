import { describe, it } from "vitest";
import { generateSarif } from "@a11yst/sarif";
import { axeRouteFinding, completeComparisonInput } from "./fixtures.js";
import { validateAgainstOfficialSchema, expectInvalidAgainstSchema } from "./schema-helper.js";

describe("official SARIF schema validation", () => {
  it("validates empty and populated logs", () => {
    const empty = generateSarif({
      product: { name: "a11yst", version: "1.0.0" },
      findings: [],
    });
    validateAgainstOfficialSchema(empty.log);

    const populated = generateSarif(
      completeComparisonInput([
        axeRouteFinding(),
      ]),
    );
    validateAgainstOfficialSchema(populated.log);
  });

  it("rejects invalid SARIF payloads", () => {
    expectInvalidAgainstSchema({ version: "2.0.0", runs: [] });
    expectInvalidAgainstSchema({
      version: "2.1.0",
      runs: [
        {
          tool: { driver: { name: "a11yst", version: "1.0.0", rules: [] } },
          results: [
            {
              ruleId: "x",
              ruleIndex: 0,
              level: "critical",
              message: { text: "x" },
            },
          ],
        },
      ],
    });
    expectInvalidAgainstSchema({
      version: "2.1.0",
      runs: [
        {
          tool: { driver: { name: "a11yst", version: "1.0.0", rules: [] } },
          results: [
            {
              ruleId: "x",
              ruleIndex: 0,
              level: "error",
              message: { text: "x" },
              baselineState: "fixed",
            },
          ],
        },
      ],
    });
  });
});
