export type Severity = "low" | "medium" | "high"

export type DetectionCategory =
  | "sensitive-data"
  | "prompt-injection"
  | "risky-upload"
  | "scam-fraud"

export type UserDecision = "warned" | "blocked" | "ignored" | "allowed" | "redacted-copied"

export type ProtectionSettings = {
  sensitiveData: boolean
  promptInjection: boolean
  uploadWarnings: boolean
  scamDetection: boolean
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
  title: string
  evidence?: string[]
}

export type FileSummary = {
  name: string
  type?: string
  size?: number
}
