export type ReportTool = "ChatGPT" | "Claude" | "Gemini" | "Other"
export type ReportLog = {
  id?: string; extensionLogId: string; timestamp: string; tool: ReportTool; hostname: string
  eventType: "sensitive-data" | "prompt-injection" | "risky-upload" | "scam-fraud"
  severity: "low" | "medium" | "high"
  decision: "warned" | "blocked" | "ignored" | "allowed" | "redacted-copied"
  feedback?: "correct-warning" | "false-alarm" | "missed-risk"
  title: string; redactedSnippet: string; evidence: string[]; createdAt: string
}
export type ReportSummary = {
  totalLogs: number; feedbackTotal: number; falseAlarmRate: number; missedRiskRate: number
  byFeedback: Record<NonNullable<ReportLog["feedback"]>, number>
  bySeverity: Record<ReportLog["severity"], number>
  byEventType: Record<ReportLog["eventType"], number>
  byDecision: Record<ReportLog["decision"], number>
  byHostname: Record<string, number>
}
export type ReportFilters = { tool?: ReportTool | "All"; hostname?: string; from?: string; to?: string }
export type AccountLogExport = { exportedAt: string; privacy: string; logs: ReportLog[] }
