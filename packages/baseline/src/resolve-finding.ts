import type { AuditExecutionResult, Finding } from "@a11yst/types";

export class FindingResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FindingResolutionError";
  }
}

export interface ResolvedFindingMatch {
  finding: Finding;
  matchKind: "id" | "fingerprint" | "prefix";
}

export function resolveFindingIdentifier(
  result: AuditExecutionResult,
  identifier: string,
): ResolvedFindingMatch {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new FindingResolutionError("Finding identifier must not be empty.");
  }

  const byId = result.findings.filter((finding) => finding.id === trimmed);
  if (byId.length === 1) {
    return { finding: byId[0]!, matchKind: "id" };
  }
  if (byId.length > 1) {
    throw new FindingResolutionError(`Finding id "${trimmed}" is ambiguous.`);
  }

  const byFingerprint = result.findings.filter((finding) => finding.fingerprint === trimmed);
  if (byFingerprint.length === 1) {
    return { finding: byFingerprint[0]!, matchKind: "fingerprint" };
  }
  if (byFingerprint.length > 1) {
    throw new FindingResolutionError(`Finding fingerprint "${trimmed}" is ambiguous.`);
  }

  const byPrefix = result.findings.filter(
    (finding) =>
      finding.id.startsWith(trimmed) || finding.fingerprint.startsWith(trimmed),
  );
  if (byPrefix.length === 1) {
    return { finding: byPrefix[0]!, matchKind: "prefix" };
  }
  if (byPrefix.length > 1) {
    throw new FindingResolutionError(
      `Finding identifier prefix "${trimmed}" matches multiple findings.`,
    );
  }

  throw new FindingResolutionError(`No finding matches identifier "${trimmed}".`);
}

export function shortFingerprint(fingerprint: string, length = 12): string {
  if (fingerprint.length <= length) {
    return fingerprint;
  }
  return `${fingerprint.slice(0, length)}…`;
}
