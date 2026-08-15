export function escapeGitHubCommandProperty(value: string): string {
  return value
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/:/g, "%3A")
    .replace(/,/g, "%2C");
}

export function escapeGitHubCommandMessage(value: string): string {
  return value
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/:/g, "%3A");
}

export function serializeGitHubAnnotationCommand(input: {
  level: "error" | "warning" | "notice";
  title: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}): string {
  const properties: string[] = [];
  if (input.file) {
    properties.push(`file=${escapeGitHubCommandProperty(input.file)}`);
  }
  if (input.line !== undefined) {
    properties.push(`line=${input.line}`);
  }
  if (input.column !== undefined) {
    properties.push(`col=${input.column}`);
  }
  if (input.endLine !== undefined) {
    properties.push(`endLine=${input.endLine}`);
  }
  if (input.endColumn !== undefined) {
    properties.push(`endColumn=${input.endColumn}`);
  }
  properties.push(`title=${escapeGitHubCommandProperty(input.title)}`);
  const prefix = properties.length > 0 ? `${properties.join(",")}::` : "";
  return `::${input.level} ${prefix}${escapeGitHubCommandMessage(input.message)}::`;
}
