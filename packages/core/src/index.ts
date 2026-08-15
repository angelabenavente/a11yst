/**
 * Core orchestrator for a11yst audit planning.
 *
 * Planning (`createAuditPlan`) builds deterministic project × route ×
 * profile × viewport combinations. Route discovery is resolved first via
 * `prepareAuditConfig` / `resolveProjectRoutesForProject`.
 */
export { createAuditPlan, freezeAuditPlan } from "./create-audit-plan.js";
export { buildRunId } from "./run-id.js";
export {
  prepareAuditConfig,
  resolveProjectRoutesForProject,
  type ResolveProjectRoutesForProjectResult,
} from "./resolve-project-routes.js";
