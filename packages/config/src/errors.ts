import { productMetadata } from "@a11yst/types";

/**
 * Structured configuration error with actionable context.
 */
export class ConfigError extends Error {
  readonly code: string;
  readonly hint?: string;
  readonly path?: string;
  readonly issues: ConfigIssue[];

  constructor(options: {
    code: string;
    message: string;
    hint?: string;
    path?: string;
    issues?: ConfigIssue[];
  }) {
    super(options.message);
    this.name = "ConfigError";
    this.code = options.code;
    this.hint = options.hint;
    this.path = options.path;
    this.issues = options.issues ?? [];
  }

  /** Multi-line message suitable for stderr. */
  format(): string {
    const lines = [`[${productMetadata.name}] ${this.message}`];
    if (this.path) {
      lines.push(`  Path: ${this.path}`);
    }
    for (const issue of this.issues) {
      const location = issue.path ? `${issue.path}: ` : "";
      lines.push(`  - ${location}${issue.message}`);
      if (issue.hint) {
        lines.push(`    Hint: ${issue.hint}`);
      }
    }
    if (this.hint) {
      lines.push(`  Hint: ${this.hint}`);
    }
    return lines.join("\n");
  }
}

export interface ConfigIssue {
  path: string;
  message: string;
  hint?: string;
}
