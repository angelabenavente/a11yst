import { dedupeFindings } from "./dedupe.js";
import { buildPolicyBreachMap, isComparisonComplete } from "./lifecycle.js";
import { buildRules, buildRuleIndexMap } from "./rules.js";
import { buildResults, countClassifiedResults, countLocatedResults } from "./results.js";
import { buildRunProperties } from "./run-properties.js";
import {
  SARIF_SCHEMA_URL,
  type SarifGenerationInput,
  type SarifGenerationOptions,
  type SarifGenerationResult,
  type SarifLog,
  type SarifGenerationDiagnostic,
} from "./types.js";
import { sortDiagnostics, validateGeneratedLog } from "./validate.js";
import { isValidSemanticVersion } from "./text.js";

export function generateSarif(
  input: SarifGenerationInput,
  options: SarifGenerationOptions = {},
): SarifGenerationResult {
  const diagnostics: SarifGenerationDiagnostic[] = [];
  const includeClassified = options.includeClassifiedFindings ?? true;

  const filteredFindings = input.findings.filter((finding) => {
    if (includeClassified) {
      return true;
    }
    return !finding.baseline?.classification;
  });

  const deduped = dedupeFindings(filteredFindings);
  for (const fingerprint of deduped.duplicateFingerprints) {
    diagnostics.push({
      code: "duplicate-result",
      level: "warning",
      message: `Duplicate finding fingerprint "${fingerprint}" was deduplicated during SARIF generation.`,
      fingerprint,
    });
  }

  const rules = buildRules(deduped.findings, diagnostics);
  const ruleIndexById = buildRuleIndexMap(rules);
  const comparisonComplete = isComparisonComplete(input);
  const policyBreaches = buildPolicyBreachMap(input.policyEvaluation);

  const results = buildResults(deduped.findings, {
    ruleIndexById,
    comparisonComplete,
    policyBreaches,
    diagnostics,
  });

  const driver: SarifLog["runs"][number]["tool"]["driver"] = {
    name: input.product.name,
    version: input.product.version,
    rules,
  };

  if (isValidSemanticVersion(input.product.version)) {
    driver.semanticVersion = input.product.version;
  }
  if (input.product.informationUri) {
    driver.informationUri = input.product.informationUri;
  }

  const runProperties = buildRunProperties({
    policyEvaluation: input.policyEvaluation,
    resolvedFindingsCount: input.resolvedFindings?.length ?? 0,
    includeResolvedSummary: options.includeResolvedSummary ?? false,
  });

  const log: SarifLog = {
    $schema: SARIF_SCHEMA_URL,
    version: "2.1.0",
    runs: [
      {
        tool: { driver },
        results,
        ...(runProperties ? { properties: runProperties } : {}),
      },
    ],
  };

  validateGeneratedLog(log);

  return {
    log,
    summary: {
      rules: rules.length,
      results: results.length,
      locatedResults: countLocatedResults(results),
      unlocatedResults: results.length - countLocatedResults(results),
      classifiedResults: countClassifiedResults(deduped.findings),
      policyBreaches: input.policyEvaluation?.summary.totalBreaches ?? 0,
      resolvedFindings: input.resolvedFindings?.length ?? 0,
    },
    diagnostics: sortDiagnostics(diagnostics),
  };
}
