import type {
  AccessibilityProfile,
  AuditExecutionStatus,
  AuditRunStatus,
  AuditSource,
  DiagnosticSeverity,
  Platform,
  Severity,
  WebFramework,
} from "./enums.js";
import type { AxeImpact } from "./severity.js";
import type {
  AuditProfileSummary,
  FindingAutomation,
  FindingComparison,
  FindingConfidence,
  NormalizedProfileOptions,
  RunProfileCoverage,
} from "./profiles.js";
import type { FlowSummary, NormalizedFlow, FlowTrace } from "./flows.js";
import type {
  BaselineConfig,
  BaselineSummary,
  FindingBaselineState,
  NotComparedFinding,
  ResolvedBaselineConfig,
  ResolvedFinding,
} from "./baseline.js";
import type { CiPolicyConfig, PolicyEvaluationResult, ResolvedCiPolicyConfig } from "./policy.js";
import type { RecommendationResult } from "./recommendations.js";
import type { SourceAnalysisOptions, SourceAnalysisSummary, ResolvedSourceAnalysisConfig } from "./source-analysis.js";
import type { SourceMappingResult } from "./source-mapping.js";
import type { SourceRankingResult } from "./source-ranking.js";
import type {
  AuditArtifactReferences,
  AuditReportReferences,
  FindingEvidence,
  RunEvidence,
  RunStructuredEvidenceRef,
} from "./artifacts.js";
import type {
  AdapterId,
  ReadinessConfig,
  ResolvedReadinessConfig,
  ResolvedRouteDiscoveryConfig,
  RouteDiscoveryConfig,
  RouteOrigin,
  RunAdapterMetadata,
} from "./adapters.js";

/**
 * Viewport used for web audit planning.
 */
export interface ViewportConfig {
  /** Human-readable viewport label (e.g. "desktop"). */
  name: string;
  /** Viewport width in CSS pixels. Must be a positive integer. */
  width: number;
  /** Viewport height in CSS pixels. Must be a positive integer. */
  height: number;
  /** Device pixel ratio used while capturing the page. Defaults to `1`. */
  deviceScaleFactor?: number;
  /** Whether the viewport should emulate a mobile device. Defaults to `false`. */
  isMobile?: boolean;
  /** Whether touch input should be enabled. Defaults to `false`. */
  hasTouch?: boolean;
  /** Viewport orientation. Inferred from dimensions when omitted. */
  orientation?: "portrait" | "landscape";
}

/**
 * Fully normalised viewport used by planning, execution, and evidence.
 */
export interface NormalizedViewport extends ViewportConfig {
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  orientation: "portrait" | "landscape";
}

/**
 * Explicit route definition. Strings in config are normalised into this shape.
 */
export interface RouteConfig {
  /**
   * Optional stable route identifier. Must contain only ASCII letters,
   * numbers, hyphens, and underscores.
   */
  id?: string;
  /** URL path relative to the project base URL. Always starts with `/`. */
  path: string;
  /** Optional friendly name for reports. */
  name?: string;
}

/**
 * Fully normalised route used by planning, results, and artifact paths.
 */
export interface NormalizedRoute extends RouteConfig {
  id: string;
  name: string;
  origin?: RouteOrigin;
  pattern?: string;
  sourceFile?: string;
  sourceLine?: number;
}

/**
 * Development server metadata.
 * Commands are only executed by `a11yst audit` — never by detect/init/doctor.
 */
export interface DevServerConfig {
  /** Shell command that starts the server (local trusted config). */
  command?: string;
  /**
   * Runtime origin of the development server.
   * When both `url` and project `baseUrl` are set they should agree;
   * mismatches produce a diagnostic and `baseUrl` wins for planning.
   */
  url?: string;
  /** Prefer an already-running server when available. */
  reuseExisting?: boolean;
  /** Milliseconds to wait for the server to become ready. */
  startupTimeout?: number;
}

/**
 * Shared project fields present on every platform.
 */
export interface ProjectConfigBase {
  /** Unique project name within the config file. */
  name: string;
  /**
   * Project root relative to the config file directory (or absolute).
   * Defaults to `"."` when omitted.
   */
  rootDir?: string;
  /**
   * Accessibility profiles to schedule. Defaults to `["default"]`.
   * Each entry may be a profile id string or a structured options object.
   */
  profiles?: ProfileConfigEntry[];
}

/**
 * Profile configuration entry — a string id or structured options.
 */
export type ProfileConfigEntry =
  | AccessibilityProfile
  | ProfileOptionsConfig;

export interface KeyboardProfileOptionsConfig {
  id: "keyboard";
  maxTabStops?: number;
  detectFocusTraps?: boolean;
  captureFocusEvidence?: boolean;
}

export interface LargeTextProfileOptionsConfig {
  id: "large-text";
  textScale?: number;
  detectHorizontalOverflow?: boolean;
  compareWithDefault?: boolean;
  overlapTolerancePx?: number;
}

export interface ReducedMotionProfileOptionsConfig {
  id: "reduced-motion";
  emulatePreference?: boolean;
  inspectAnimations?: boolean;
  minimumSignificantDurationMs?: number;
  compareWithDefault?: boolean;
}

export interface DefaultProfileOptionsConfig {
  id: "default";
}

export type ProfileOptionsConfig =
  | DefaultProfileOptionsConfig
  | KeyboardProfileOptionsConfig
  | LargeTextProfileOptionsConfig
  | ReducedMotionProfileOptionsConfig;

/**
 * Web project configuration.
 *
 * Provide `baseUrl` and/or `devServer.url`. After resolution a single
 * `baseUrl` is always present. Prefer `baseUrl` as the planning origin;
 * use `devServer` for launch metadata during audit.
 */
export interface WebProjectConfig extends ProjectConfigBase {
  platform: "web";
  /** Web framework. Defaults to `"unknown"` when omitted. */
  framework?: WebFramework;
  /**
   * Origin used to resolve routes.
   * Optional when `devServer.url` is provided; otherwise required.
   */
  baseUrl?: string;
  /** Optional development server metadata. */
  devServer?: DevServerConfig;
  /**
   * Paths or route objects to audit.
   * Optional when routeDiscovery fallback or merge can supply routes.
   */
  routes?: Array<string | RouteConfig>;
  /** Filesystem route discovery settings. */
  routeDiscovery?: RouteDiscoveryConfig;
  /** Page readiness settings for audit execution. */
  readiness?: ReadinessConfig;
  /** Viewports to schedule. Defaults to a desktop viewport when omitted. */
  viewports?: ViewportConfig[];
}

/**
 * A configured project.
 */
export type ProjectConfig = WebProjectConfig;

/** SARIF report settings in user configuration. */
export interface SarifReportConfig {
  enabled?: boolean;
  /** Optional external output path when SARIF is enabled via config. */
  output?: string;
}

/** JUnit report settings in user configuration. */
export interface JunitReportConfig {
  enabled?: boolean;
  output?: string;
}

/** Markdown report settings in user configuration. */
export interface MarkdownReportConfig {
  enabled?: boolean;
  output?: string;
}

/** GitHub annotations artifact settings in user configuration. */
export interface GitHubAnnotationsReportConfig {
  enabled?: boolean;
  output?: string;
}

/** Report output settings in user configuration. */
export interface ReportsConfig {
  /** Generate HTML reports during audit. Defaults to enabled via CLI. */
  html?: boolean;
  /** Generate SARIF reports during audit. Defaults to disabled. */
  sarif?: boolean | SarifReportConfig;
  /** Generate JUnit XML reports during audit. Defaults to disabled. */
  junit?: boolean | JunitReportConfig;
  /** Generate Markdown reports during audit. Defaults to disabled. */
  markdown?: boolean | MarkdownReportConfig;
  /** Generate GitHub workflow annotation commands during audit. Defaults to disabled. */
  githubAnnotations?: boolean | GitHubAnnotationsReportConfig;
  /** Write Markdown to GITHUB_STEP_SUMMARY when set in the runner. Defaults to disabled. */
  githubStepSummary?: boolean;
}

/**
 * Top-level configuration accepted by `defineConfig`.
 */
export interface A11ystConfig {
  /**
   * Directory for future audit artefacts, relative to the config file.
   * Defaults to `.a11yst/results`.
   */
  outputDir?: string;
  /** Report output settings. */
  reports?: ReportsConfig;
  /** Evidence capture settings. Both fields are optional for old configs. */
  evidence?: {
    /** Capture element-level evidence screenshots. Defaults to `true`. */
    screenshots?: boolean;
    /** Capture full-page screenshots rather than the visible viewport. */
    fullPage?: boolean;
  };
  /** Baseline and comparison settings. */
  baseline?: BaselineConfig;
  /** CI policy settings for future gate evaluation. */
  ci?: CiPolicyConfig;
  /** Source mapping, ranking, and recommendation orchestration. */
  sourceAnalysis?: SourceAnalysisOptions;
  /** One or more projects to plan audits for. */
  projects: ProjectConfig[];
}

/** Fully normalised evidence capture settings. */
export interface ResolvedEvidenceConfig {
  screenshots: boolean;
  fullPage: boolean;
}

/**
 * Normalised development server on a resolved web project.
 */
export interface ResolvedDevServer {
  command?: string;
  url?: string;
  reuseExisting: boolean;
  startupTimeout: number;
}

/**
 * Normalised, validated project used by the planner.
 */
export interface ResolvedWebProject {
  name: string;
  rootDir: string;
  platform: "web";
  framework: WebFramework;
  /** Resolved at plan time from framework; stored on the project. */
  adapterId: AdapterId;
  /** Canonical origin used for planning (from baseUrl or devServer.url). */
  baseUrl: string;
  routes: NormalizedRoute[];
  routeDiscovery: ResolvedRouteDiscoveryConfig;
  readiness: ResolvedReadinessConfig;
  profiles: AccessibilityProfile[];
  profileOptions: NormalizedProfileOptions[];
  viewports: NormalizedViewport[];
  devServer?: ResolvedDevServer;
  flows: NormalizedFlow[];
}

export type ResolvedProject = ResolvedWebProject;

/**
 * Fully normalised configuration after validation and defaults.
 */
/** Normalised report settings used during audit execution. */
export interface ResolvedReportsConfig {
  html: boolean;
  sarif: boolean;
  sarifOutput?: string;
  junit: boolean;
  junitOutput?: string;
  markdown: boolean;
  markdownOutput?: string;
  githubAnnotations: boolean;
  githubAnnotationsOutput?: string;
  githubStepSummary: boolean;
}

export interface ResolvedConfig {
  outputDir: string;
  evidence: ResolvedEvidenceConfig;
  reports: ResolvedReportsConfig;
  baseline: ResolvedBaselineConfig;
  ci: ResolvedCiPolicyConfig;
  sourceAnalysis: ResolvedSourceAnalysisConfig;
  projects: ResolvedProject[];
  /** Absolute directory that owned the config file. */
  configDir: string;
  /** Absolute path to the loaded config file. */
  configPath: string;
  /** Non-blocking diagnostics raised during validation. */
  diagnostics: Diagnostic[];
}

/**
 * Request that will eventually drive an audit engine.
 */
export interface AuditRequest {
  id: string;
  projectName: string;
  platform: Platform;
  framework: WebFramework;
  profile: AccessibilityProfile;
  route?: RouteConfig;
  viewport?: ViewportConfig;
  baseUrl?: string;
}

export type PlannedRunKind = "route" | "flow-checkpoint";

/**
 * One planned execution derived from config combinations.
 */
export interface PlannedRun {
  id: string;
  kind?: PlannedRunKind;
  projectName: string;
  platform: Platform;
  framework: WebFramework;
  profile: AccessibilityProfile;
  /** Stable route identity, additive to the existing route object. */
  routeId?: string;
  /** Human-readable route name, additive to the existing route object. */
  routeName?: string;
  route?: NormalizedRoute;
  viewport?: ViewportConfig;
  baseUrl?: string;
  adapter?: RunAdapterMetadata;
  /** Flow session grouping: flow × profile × viewport. */
  sessionId?: string;
  flowId?: string;
  flowName?: string;
  checkpointId?: string;
  checkpointName?: string;
  flowStart?: string;
}

/**
 * Deterministic audit plan produced by the core orchestrator.
 */
export interface AuditPlan {
  projects: ResolvedProject[];
  runs: PlannedRun[];
  /** Total planned executions (same as `runs.length`). */
  totalRuns: number;
  /** Non-blocking diagnostics collected while planning. */
  diagnostics: Diagnostic[];
  createdAt: string;
}

/**
 * Accessibility finding normalised from axe-core (or a11yst itself).
 *
 * `fingerprint` is an initial deterministic key for this phase and will be
 * refined when baselines arrive in a later phase — do not treat it as final.
 */
export interface Finding {
  id: string;
  fingerprint: string;
  /** Fingerprint algorithm version; omitted on legacy findings means version 1. */
  fingerprintVersion?: "1";
  source: AuditSource;
  ruleId: string;
  title: string;
  description?: string;
  /** @deprecated Prefer `title`. Kept for early Phase 1 call sites. */
  message?: string;
  /** Canonical a11yst severity for this finding. */
  severity: Severity;
  /**
   * Raw axe-core impact when `source` is `"axe"`.
   * Provider terminology — not the public a11yst severity label.
   */
  sourceImpact?: AxeImpact | null;
  routeId?: string;
  routeName?: string;
  route?: string;
  url?: string;
  projectName: string;
  profile: AccessibilityProfile;
  viewport?: string;
  target: string[];
  html?: string;
  failureSummary?: string;
  helpUrl?: string;
  standards: string[];
  evidence?: FindingEvidence;
  /** Confidence in the finding when produced by a11yst heuristics. */
  confidence?: FindingConfidence;
  /** How the finding was produced. axe findings default to automated/high. */
  automation?: FindingAutomation;
  /** Optional comparison metadata for profile findings. */
  comparison?: FindingComparison;
  /** Flow checkpoint context when the finding was produced during a flow. */
  flowId?: string;
  checkpointId?: string;
  /** Baseline comparison state when a baseline was used. */
  baseline?: FindingBaselineState;
  /**
   * Optional structured source mapping produced after audit.
   * Omitted on legacy findings and during Phase 10a — not populated by the audit engine yet.
   */
  sourceMapping?: SourceMappingResult;
  /** Optional ranked source mapping produced after audit. */
  sourceRanking?: SourceRankingResult;
  /** Optional accessibility recommendations produced after audit. */
  recommendations?: RecommendationResult;
}

/**
 * Result of executing one planned run.
 */
export interface AuditRunResult {
  runId: string;
  kind?: PlannedRunKind;
  projectName: string;
  platform: Platform;
  framework: WebFramework;
  routeId?: string;
  routeName?: string;
  route?: string;
  url?: string;
  profile: AccessibilityProfile;
  viewport?: ViewportConfig;
  status: AuditRunStatus;
  startedAt: string;
  durationMs: number;
  findings: Finding[];
  diagnostics: Diagnostic[];
  skipReason?: string;
  evidence?: RunEvidence;
  profileEvidence?: RunStructuredEvidenceRef[];
  adapter?: RunAdapterMetadata;
  coverage?: RunProfileCoverage;
  profileMetadata?: Record<string, unknown>;
  internalBaseline?: boolean;
  sessionId?: string;
  flowId?: string;
  flowName?: string;
  checkpointId?: string;
  checkpointName?: string;
  flowTracePath?: string;
}

/**
 * Aggregated counts for an audit execution.
 */
export interface AuditSummary {
  status: AuditExecutionStatus;
  startedAt: string;
  durationMs: number;
  plannedRuns: number;
  completedRuns: number;
  skippedRuns: number;
  failedRuns: number;
  findingCount: number;
  findingsBySeverity: Record<Severity, number>;
}

/**
 * Full serialisable result of `executeAudit`.
 */
export interface AuditExecutionResult {
  schemaVersion: "1";
  /** Stable identifier for the persisted audit bundle, when artifacts exist. */
  auditId?: string;
  /** User-facing paths to persisted audit artifacts. */
  artifacts?: AuditArtifactReferences;
  status: AuditExecutionStatus;
  summary: AuditSummary;
  plan: AuditPlan;
  runs: AuditRunResult[];
  findings: Finding[];
  diagnostics: Diagnostic[];
  limitations: string[];
  profileSummary?: AuditProfileSummary;
  flowSummary?: FlowSummary;
  /** Flow session traces for terminal output and reporting (one per flow × profile × viewport session). */
  flowExecutions?: FlowTrace[];
  /** Baseline comparison summary when a baseline was used. */
  baselineSummary?: BaselineSummary;
  /** Findings resolved since the baseline within confirmed coverage. */
  resolvedFindings?: ResolvedFinding[];
  /** Baseline entries not compared due to missing audit coverage. */
  notComparedFindings?: NotComparedFinding[];
  /** CI policy evaluation when policy gates were resolved for this audit. */
  policyEvaluation?: PolicyEvaluationResult;
  /** Source analysis summary when mapping/ranking/recommendations ran. */
  sourceAnalysis?: SourceAnalysisSummary;
  /** References to generated report artifacts. */
  reports?: AuditReportReferences;
  environment: {
    product: string;
    productVersion: string;
    nodeVersion: string;
    browser?: string;
    headed: boolean;
  };
}

/**
 * Legacy placeholder result contract (superseded by AuditRunResult).
 */
export interface AuditResult {
  requestId: string;
  status: "pending" | "planned" | "passed" | "failed" | "skipped";
  findings: Finding[];
  diagnostics: Diagnostic[];
}

/**
 * Non-blocking or advisory message produced during config/planning/detection/audit.
 */
export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  hint?: string;
  path?: string;
}
