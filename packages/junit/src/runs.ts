import type { AuditRunResult } from "@a11yst/types";
import type { JunitGenerationDiagnostic, JunitTestCase } from "./types.js";
import {
  MAX_BODY_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_TESTCASE_NAME_LENGTH,
  pushTruncatedDiagnostic,
  truncateText,
} from "./text.js";
import { formatDurationSeconds } from "./duration.js";
import { sanitizeXmlString } from "./xml.js";

function runViewportName(run: AuditRunResult): string {
  return run.viewport?.name ?? "default";
}

export function buildRouteTestCaseName(run: AuditRunResult): string {
  const route = run.route ?? run.routeName ?? "(unknown-route)";
  return truncateText(
    `route ${route} [${run.profile}, ${runViewportName(run)}]`,
    MAX_TESTCASE_NAME_LENGTH,
  ).text;
}

export function buildFlowTestCaseName(run: AuditRunResult): string {
  const flowId = run.flowId ?? run.flowName ?? "flow";
  const checkpoint = run.checkpointId ?? run.checkpointName ?? "checkpoint";
  return truncateText(
    `flow ${flowId} / checkpoint ${checkpoint} [${run.profile}, ${runViewportName(run)}]`,
    MAX_TESTCASE_NAME_LENGTH,
  ).text;
}

export function buildRunTestCase(
  run: AuditRunResult,
  diagnostics: JunitGenerationDiagnostic[],
): JunitTestCase | undefined {
  const isFlow = run.kind === "flow-checkpoint" || Boolean(run.flowId && run.checkpointId);
  const name = isFlow ? buildFlowTestCaseName(run) : buildRouteTestCaseName(run);
  const classname = `${run.projectName}.${isFlow ? "flow" : "route"}`;
  const time = formatDurationSeconds(run.durationMs, diagnostics, classname);

  if (run.status === "completed") {
    return { name, classname, time };
  }

  if (run.status === "skipped") {
    const messageSource = run.skipReason ?? "Run was skipped.";
    const message = truncateText(sanitizeXmlString(messageSource), MAX_MESSAGE_LENGTH);
    if (message.truncated) {
      pushTruncatedDiagnostic(diagnostics, classname);
    }
    return {
      name,
      classname,
      time,
      skipped: { message: message.text },
    };
  }

  if (run.status === "failed") {
    const messageSource =
      run.diagnostics.find((entry) => entry.severity === "error")?.message ??
      run.skipReason ??
      "Run failed.";
    const message = truncateText(sanitizeXmlString(messageSource), MAX_MESSAGE_LENGTH);
    const content = truncateText(sanitizeXmlString(messageSource), MAX_BODY_LENGTH);
    if (message.truncated || content.truncated) {
      pushTruncatedDiagnostic(diagnostics, classname);
    }
    return {
      name,
      classname,
      time,
      error: {
        type: "a11ystOperationalError",
        message: message.text,
        content: content.text,
      },
    };
  }

  diagnostics.push({
    code: "unsupported-status",
    level: "warning",
    message: `Unsupported run status "${run.status}" for ${classname}.`,
  });
  return undefined;
}
