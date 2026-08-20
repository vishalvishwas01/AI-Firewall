/** Storage feature boundary. Keep browser storage details behind this API. */
export {
  addActivityLog,
  addWarningFeedbackRecord,
  clearActivityLogs,
  getActivityLogs,
  getLocalReportExport,
  getProtectedSites,
  getQueuedSyncLogs,
  getSettings,
  retryQueuedSyncLogs,
  requestQueuedSync,
  saveProtectedSites,
  setAllProtections,
  setSetting,
  updateActivityLogFeedback
} from "./storage"
export type {
  ActivityLog,
  ProtectedSite,
  OrganizationPolicy,
  ProtectionSettings,
  SensitivityMode,
  UserDecision,
  WarningFeedback,
  WarningFeedbackRecord
} from "../../firewall/types"
