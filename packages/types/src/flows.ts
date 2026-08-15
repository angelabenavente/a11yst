import type { AccessibilityProfile } from "./enums.js";
import type { Diagnostic } from "./config.js";
import type { NormalizedProfileOptions } from "./profiles.js";
import type { ViewportConfig } from "./config.js";

/** Serializable locator — exactly one strategy per object. */
export type LocatorRoleConfig = {
  role: string;
  name?: string;
  exact?: boolean;
};

export type LocatorLabelConfig = {
  label: string;
  exact?: boolean;
};

export type LocatorTextConfig = {
  text: string;
  exact?: boolean;
};

export type LocatorPlaceholderConfig = {
  placeholder: string;
  exact?: boolean;
};

export type LocatorTestIdConfig = {
  testId: string;
};

export type LocatorCssConfig = {
  css: string;
};

export type LocatorConfig =
  | LocatorRoleConfig
  | LocatorLabelConfig
  | LocatorTextConfig
  | LocatorPlaceholderConfig
  | LocatorTestIdConfig
  | LocatorCssConfig;

export type FlowStepAction =
  | "goto"
  | "click"
  | "fill"
  | "press"
  | "check"
  | "uncheck"
  | "select"
  | "wait-for"
  | "wait-for-url"
  | "expect-visible"
  | "expect-hidden"
  | "expect-text"
  | "expect-url"
  | "checkpoint";

export type WaitForState =
  | "visible"
  | "hidden"
  | "attached"
  | "detached"
  | "enabled"
  | "disabled";

export interface FlowStepBase {
  action: FlowStepAction;
}

export interface FlowGotoStep extends FlowStepBase {
  action: "goto";
  path: string;
}

export interface FlowLocatorStep extends FlowStepBase {
  locator: LocatorConfig;
}

export interface FlowClickStep extends FlowLocatorStep {
  action: "click";
}

export interface FlowFillStep extends FlowLocatorStep {
  action: "fill";
  value?: string;
  valueFromEnv?: string;
  sensitive?: boolean;
}

export interface FlowPressStep extends FlowStepBase {
  action: "press";
  key: string;
  locator?: LocatorConfig;
}

export interface FlowCheckStep extends FlowLocatorStep {
  action: "check";
}

export interface FlowUncheckStep extends FlowLocatorStep {
  action: "uncheck";
}

export interface FlowSelectStep extends FlowLocatorStep {
  action: "select";
  value?: string;
  label?: string;
}

export interface FlowWaitForStep extends FlowLocatorStep {
  action: "wait-for";
  state?: WaitForState;
}

export interface FlowWaitForUrlStep extends FlowStepBase {
  action: "wait-for-url";
  url?: string;
  path?: string;
}

export interface FlowExpectVisibleStep extends FlowLocatorStep {
  action: "expect-visible";
}

export interface FlowExpectHiddenStep extends FlowLocatorStep {
  action: "expect-hidden";
}

export interface FlowExpectTextStep extends FlowLocatorStep {
  action: "expect-text";
  text: string;
  exact?: boolean;
}

export interface FlowExpectUrlStep extends FlowStepBase {
  action: "expect-url";
  url?: string;
  path?: string;
}

export interface FlowCheckpointStep extends FlowStepBase {
  action: "checkpoint";
  id: string;
  name?: string;
}

export type FlowStepConfig =
  | FlowGotoStep
  | FlowClickStep
  | FlowFillStep
  | FlowPressStep
  | FlowCheckStep
  | FlowUncheckStep
  | FlowSelectStep
  | FlowWaitForStep
  | FlowWaitForUrlStep
  | FlowExpectVisibleStep
  | FlowExpectHiddenStep
  | FlowExpectTextStep
  | FlowExpectUrlStep
  | FlowCheckpointStep;

export interface FlowConfig {
  id: string;
  name?: string;
  start: string;
  profiles?: Array<AccessibilityProfile | Record<string, unknown>>;
  viewports?: string[];
  storageState?: string;
  allowOrigins?: string[];
  stepTimeout?: number;
  navigationTimeout?: number;
  steps: FlowStepConfig[];
}

export type NormalizedFlowStep = FlowStepConfig & {
  index: number;
};

export interface NormalizedFlow {
  id: string;
  name: string;
  start: string;
  profiles: AccessibilityProfile[];
  profileOptions: NormalizedProfileOptions[];
  viewportNames: string[];
  viewports: ViewportConfig[];
  storageState?: string;
  allowOrigins: string[];
  stepTimeout: number;
  navigationTimeout: number;
  steps: NormalizedFlowStep[];
  checkpointIds: string[];
  requiredEnvVars: string[];
}

export interface SerializedLocator {
  strategy: "role" | "label" | "text" | "placeholder" | "testId" | "css";
  description: string;
}

export interface ElementSummary {
  target: string[];
  role?: string;
  accessibleName?: string;
  visible: boolean;
}

export interface ActionObservation {
  urlBefore?: string;
  urlAfter?: string;
  activeElementBefore?: ElementSummary;
  activeElementAfter?: ElementSummary;
  visibleDialogsBefore?: ElementSummary[];
  visibleDialogsAfter?: ElementSummary[];
  errorMessagesBefore?: ElementSummary[];
  errorMessagesAfter?: ElementSummary[];
}

export type FlowStepStatus = "completed" | "failed" | "skipped";

export interface FlowStepResult {
  index: number;
  action: string;
  status: FlowStepStatus;
  startedAt: string;
  durationMs: number;
  locator?: SerializedLocator;
  target?: string[];
  checkpointId?: string;
  checkpointName?: string;
  diagnostics: Diagnostic[];
  evidence?: string[];
  observedChanges?: ActionObservation;
  failureReason?: string;
}

export interface FlowCheckpointResult {
  checkpointId: string;
  checkpointName: string;
  stepIndex: number;
  status: "completed" | "failed" | "skipped";
  startedAt?: string;
  durationMs?: number;
  url?: string;
  documentTitle?: string;
  diagnostics: Diagnostic[];
  evidence?: string[];
  runId?: string;
}

export interface FlowTrace {
  schemaVersion: "1";
  projectName: string;
  flowId: string;
  flowName: string;
  profile: AccessibilityProfile;
  viewport: string;
  sessionId: string;
  startedAt: string;
  durationMs: number;
  status: "completed" | "failed";
  steps: FlowStepResult[];
  checkpoints: FlowCheckpointResult[];
  diagnostics: Diagnostic[];
}

export interface FlowSummary {
  configuredFlows: number;
  completedFlows: number;
  failedFlows: number;
  completedCheckpoints: number;
  skippedCheckpoints: number;
  failedCheckpoints: number;
}
