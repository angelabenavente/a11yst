import type {
  DetectionConfidence,
  DetectionEvidenceType,
  PackageManagerName,
  Platform,
  SupportLevel,
  WebFramework,
} from "./enums.js";
import type { Diagnostic } from "./config.js";

/**
 * A single explainable signal collected during project detection.
 */
export interface DetectionEvidence {
  type: DetectionEvidenceType;
  /** Concrete value observed (dependency name, file path, script, …). */
  value: string;
  /** Human-readable explanation of why this signal matters. */
  description: string;
  /** Relative contribution weight used while scoring. */
  weight: number;
}

/**
 * A scored framework alternative that lost to the selected framework.
 */
export interface FrameworkCandidate {
  framework: WebFramework;
  score: number;
  evidence: DetectionEvidence[];
}

/**
 * Result of framework/platform detection for one project root.
 */
export interface FrameworkDetection {
  platform: Platform | "unknown";
  framework: WebFramework;
  supportLevel: SupportLevel;
  confidence: DetectionConfidence;
  /** Aggregate score of the winning framework. */
  score: number;
  evidence: DetectionEvidence[];
  alternatives: FrameworkCandidate[];
  diagnostics: Diagnostic[];
}

/**
 * Candidate command that could start a development server.
 * Detection never executes these commands.
 */
export interface DevServerCandidate {
  command: string;
  sourceScript: string;
  confidence: DetectionConfidence;
  inferredPort?: number;
  inferredUrl?: string;
  /** Human-readable explanation of how inferredUrl was chosen. */
  inferredUrlSource?: string;
  evidence: DetectionEvidence[];
}

/**
 * Package manager detection outcome.
 */
export interface PackageManagerDetection {
  name: PackageManagerName;
  confidence: DetectionConfidence;
  evidence: DetectionEvidence[];
  diagnostics: Diagnostic[];
}

/**
 * A workspace package that looks like an auditable application.
 */
export interface DetectedProject {
  /** Absolute path to the project root. */
  rootDir: string;
  /** Path relative to the detection cwd when available. */
  relativeRoot: string;
  name: string;
  framework: FrameworkDetection;
  packageManager: PackageManagerDetection;
  devServers: DevServerCandidate[];
  /** True when signals suggest a library package rather than an app. */
  isLibrary: boolean;
  diagnostics: Diagnostic[];
}

/**
 * Result of inspecting a single directory as a project.
 */
export interface ProjectDetectionResult {
  cwd: string;
  rootDir: string;
  project: DetectedProject;
  diagnostics: Diagnostic[];
}

/**
 * Result of inspecting a repository that may contain multiple apps.
 */
export interface WorkspaceDetectionResult {
  cwd: string;
  workspaceRoot: string;
  packageManager: PackageManagerDetection;
  projects: DetectedProject[];
  diagnostics: Diagnostic[];
}
