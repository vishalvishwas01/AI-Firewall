export {
  analyzeText,
  defaultSettings,
  detectPromptInjection,
  detectRiskyUploads,
  detectScamFraud,
  detectSensitiveData,
  highestSeverity
} from "./detectors"
export { redactSensitiveText, redactSnippet } from "./redact"
export type {
  Detection,
  DetectionCategory,
  FileSummary,
  ProtectionSettings,
  SensitivityMode,
  Severity
} from "./types"
