export type Severity = "low" | "medium" | "high"

export type SensitivityMode = "relaxed" | "balanced" | "strict"

export type DetectionCategory =
  | "sensitive-data"
  | "prompt-injection"
  | "risky-upload"
  | "scam-fraud"

export type UserDecision = "warned" | "blocked" | "ignored" | "allowed" | "redacted-copied"

export type WarningFeedback = "correct-warning" | "false-alarm" | "missed-risk"

export type ProtectionSettings = {
  sensitiveData: boolean
  promptInjection: boolean
  uploadWarnings: boolean
  scamDetection: boolean
  sensitivityMode: SensitivityMode
  redactedSync: boolean
}

export type ProtectedSite = {
  hostname: string
  label: string
  isDefault: boolean
}

export type Detection = {
  category: DetectionCategory
  severity: Severity
  title: string
  message: string
  evidence: string[]
}

export type ActivityLog = {
  id: string
  timestamp: number
  site: string
  eventType: DetectionCategory
  severity: Severity
  redactedSnippet: string
  decision: UserDecision
  feedback?: WarningFeedback
  title: string
  evidence?: string[]
}

export type WarningFeedbackRecord = {
  id: string
  timestamp: number
  site: string
  feedback: WarningFeedback
}

export type FileSummary = {
  name: string
  type?: string
  size?: number
}
