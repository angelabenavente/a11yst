export { runCli } from "./run-cli.js";
export type { RunCliOptions } from "./run-cli.js";

export {
  formatDetectHuman,
  formatDetectJson,
  runDetect,
} from "./commands/detect.js";
export {
  formatFlowsHuman,
  formatFlowsJson,
  runFlows,
} from "./commands/flows.js";
export {
  formatRoutesHuman,
  formatRoutesJson,
  runRoutes,
} from "./commands/routes.js";
export { formatAuditHuman, formatAuditJson } from "./commands/audit.js";
export {
  formatReportHuman,
  formatReportJson,
  runReport,
} from "./commands/report.js";
export {
  formatProfilesHuman,
  formatProfilesJson,
  runProfiles,
} from "./commands/profiles.js";
export {
  formatDoctorHuman,
  formatDoctorJson,
  runDoctor,
} from "./commands/doctor.js";
export {
  assertCanWriteConfig,
  buildInitConfigSource,
  configFilePath,
  formatInitHuman,
  formatInitJson,
  runInit,
} from "./commands/init.js";
