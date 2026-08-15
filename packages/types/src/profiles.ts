import type { AccessibilityProfile } from "./enums.js";
import type { Diagnostic, Finding } from "./config.js";
import type { BoundingBox, RunStructuredEvidenceRef } from "./artifacts.js";

export type ProfileId = AccessibilityProfile;

export type ProfileCapability =
  | "axe"
  | "keyboard-navigation"
  | "focus-observation"
  | "text-scaling"
  | "layout-comparison"
  | "media-emulation"
  | "motion-inspection";

export type FindingConfidence = "high" | "medium" | "low";

export type FindingAutomation = "automated" | "heuristic" | "manual-review";

export interface FindingComparison {
  baselineProfile: "default";
  currentProfile: ProfileId;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface ProfileCoverage {
  automatedChecks: string[];
  heuristicChecks: string[];
  manualChecks: string[];
  limitations: string[];
}

export interface FocusStep {
  index: number;
  direction: "forward" | "backward";
  target?: string[];
  role?: string;
  accessibleName?: string;
  tabindex?: number;
  visible: boolean;
  inViewport: boolean;
  boundingBox?: BoundingBox;
  screenshot?: string;
}

export interface MotionRecord {
  target: string[];
  animationName?: string;
  durationMs?: number;
  delayMs?: number;
  iterations?: number | "infinite";
  playState?: string;
  properties?: string[];
  source: "web-animation" | "css-animation" | "css-transition";
}

export interface ProfileEvidence {
  kind: RunStructuredEvidenceRef["kind"];
  path?: string;
  data?: Record<string, unknown>;
}

export interface ProfileSnapshot {
  profile: ProfileId;
  url: string;
  capturedAt: string;
  screenshot?: string;
  scrollWidth?: number;
  scrollHeight?: number;
  clientWidth?: number;
  clientHeight?: number;
  motionRecords?: MotionRecord[];
  elementSnapshots?: Array<{
    target: string[];
    boundingBox?: BoundingBox;
    visible: boolean;
    text?: string;
  }>;
}

export interface NormalizedDefaultProfileOptions {
  id: "default";
}

export interface NormalizedKeyboardProfileOptions {
  id: "keyboard";
  maxTabStops: number;
  detectFocusTraps: boolean;
  captureFocusEvidence: boolean;
}

export interface NormalizedLargeTextProfileOptions {
  id: "large-text";
  textScale: number;
  detectHorizontalOverflow: boolean;
  compareWithDefault: boolean;
  overlapTolerancePx: number;
}

export interface NormalizedReducedMotionProfileOptions {
  id: "reduced-motion";
  emulatePreference: boolean;
  inspectAnimations: boolean;
  minimumSignificantDurationMs: number;
  compareWithDefault: boolean;
}

export type NormalizedProfileOptions =
  | NormalizedDefaultProfileOptions
  | NormalizedKeyboardProfileOptions
  | NormalizedLargeTextProfileOptions
  | NormalizedReducedMotionProfileOptions;

export interface ProfileExecutionMetadata {
  profileVersion: string;
  internalBaselineUsed?: boolean;
  strategy?: string;
  scale?: number;
}

export interface RunProfileCoverage extends ProfileCoverage {
  profile: ProfileId;
  status: "completed" | "failed" | "skipped";
  a11ystRulesExecuted: string[];
  axeExecuted: boolean;
}

export interface AuditProfileSummary {
  completed: ProfileId[];
  failed: ProfileId[];
  skipped: ProfileId[];
  coverage: RunProfileCoverage[];
  findingsBySource: Record<"axe" | "a11yst", number>;
  findingsByAutomation: Record<FindingAutomation, number>;
  findingsByConfidence: Record<FindingConfidence, number>;
  manualReviewPending: number;
}

export interface A11ystFindingExtensions {
  confidence?: FindingConfidence;
  automation?: FindingAutomation;
  comparison?: FindingComparison;
}

export type ProfileFinding = Finding & A11ystFindingExtensions;

export interface ProfileExecutionResult {
  profile: ProfileId;
  status: "completed" | "failed" | "skipped";
  findings: ProfileFinding[];
  diagnostics: Diagnostic[];
  evidence: ProfileEvidence[];
  coverage: ProfileCoverage;
  snapshot?: ProfileSnapshot;
  metadata: ProfileExecutionMetadata;
}
