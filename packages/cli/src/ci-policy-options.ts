import type { CiPolicyCliOverrides } from "@a11yst/policy";
import { isValidMinimumSeverity } from "@a11yst/policy";
import type { Severity } from "@a11yst/types";

export type ParsedCiPolicyCliOptions = {
  overrides: CiPolicyCliOverrides;
  explicitFlagsUsed: boolean;
};

const POLICY_FLAGS = [
  "--fail-on-new",
  "--no-fail-on-new",
  "--fail-on-regression",
  "--no-fail-on-regression",
  "--fail-on-expired-classification",
  "--no-fail-on-expired-classification",
  "--minimum-severity",
] as const;

function argvIncludes(argv: readonly string[], flag: string): boolean {
  return argv.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
}

export function parseCiPolicyCliOptions(
  opts: {
    failOnNew?: boolean;
    noFailOnNew?: boolean;
    failOnRegression?: boolean;
    noFailOnRegression?: boolean;
    failOnExpiredClassification?: boolean;
    noFailOnExpiredClassification?: boolean;
    minimumSeverity?: string;
  },
  argv: readonly string[] = process.argv,
): ParsedCiPolicyCliOptions {
  const overrides: CiPolicyCliOverrides = {};
  const explicitFlagsUsed = POLICY_FLAGS.some((flag) => argvIncludes(argv, flag));

  if (argvIncludes(argv, "--fail-on-new") && argvIncludes(argv, "--no-fail-on-new")) {
    throw new Error(
      "Cannot use --fail-on-new and --no-fail-on-new together. Choose one CI policy override.",
    );
  }
  if (
    argvIncludes(argv, "--fail-on-regression") &&
    argvIncludes(argv, "--no-fail-on-regression")
  ) {
    throw new Error(
      "Cannot use --fail-on-regression and --no-fail-on-regression together. Choose one CI policy override.",
    );
  }
  if (
    argvIncludes(argv, "--fail-on-expired-classification") &&
    argvIncludes(argv, "--no-fail-on-expired-classification")
  ) {
    throw new Error(
      "Cannot use --fail-on-expired-classification and --no-fail-on-expired-classification together. Choose one CI policy override.",
    );
  }

  if (argvIncludes(argv, "--fail-on-new")) {
    overrides.failOnNew = true;
  } else if (argvIncludes(argv, "--no-fail-on-new")) {
    overrides.failOnNew = false;
  }

  if (argvIncludes(argv, "--fail-on-regression")) {
    overrides.failOnRegression = true;
  } else if (argvIncludes(argv, "--no-fail-on-regression")) {
    overrides.failOnRegression = false;
  }

  if (argvIncludes(argv, "--fail-on-expired-classification")) {
    overrides.failOnExpiredClassification = true;
  } else if (argvIncludes(argv, "--no-fail-on-expired-classification")) {
    overrides.failOnExpiredClassification = false;
  }

  if (opts.minimumSeverity !== undefined) {
    if (!isValidMinimumSeverity(opts.minimumSeverity)) {
      throw new Error(
        `Invalid --minimum-severity "${opts.minimumSeverity}". Expected one of: minor, medium, high, critical.`,
      );
    }
    overrides.minimumSeverity = opts.minimumSeverity as Severity;
  }

  return { overrides, explicitFlagsUsed };
}
