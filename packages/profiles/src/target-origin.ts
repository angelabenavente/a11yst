/**
 * Verify that browser navigation stayed on the configured application origin.
 */

export class TargetOriginMismatchError extends Error {
  readonly code = "TARGET_ORIGIN_MISMATCH";

  constructor(
    readonly configuredOrigin: string,
    readonly actualOrigin: string,
    readonly route: string,
    readonly configuredTarget: string,
    readonly actualTarget: string,
  ) {
    super(
      `Configured target ${configuredTarget} but browser navigated to ${actualTarget} for route ${route}. No accessibility result from this execution should be trusted.`,
    );
    this.name = "TargetOriginMismatchError";
  }
}

export function originOf(url: string): string {
  return new URL(url).origin;
}

export function sanitizeUrlForDiagnostics(url: string): string {
  const parsed = new URL(url);
  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function assertConfiguredTargetOrigin(params: {
  configuredTargetUrl: string;
  actualPageUrl: string;
  route: string;
}): void {
  const configuredOrigin = originOf(params.configuredTargetUrl);
  const actualOrigin = originOf(params.actualPageUrl);
  if (configuredOrigin === actualOrigin) {
    return;
  }

  throw new TargetOriginMismatchError(
    configuredOrigin,
    actualOrigin,
    params.route,
    sanitizeUrlForDiagnostics(params.configuredTargetUrl),
    sanitizeUrlForDiagnostics(params.actualPageUrl),
  );
}

export function targetOriginMismatchDiagnostic(
  error: TargetOriginMismatchError,
): {
  code: "TARGET_ORIGIN_MISMATCH";
  severity: "error";
  message: string;
  hint: string;
} {
  return {
    code: "TARGET_ORIGIN_MISMATCH",
    severity: "error",
    message: error.message,
    hint:
      "Ensure baseUrl matches the dev server you intend to audit. A different application running on another port must not become the audit target.",
  };
}
