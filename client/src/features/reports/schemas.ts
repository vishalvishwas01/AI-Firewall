import { array, dictionary, isoDate, nonEmptyString, nonNegativeInteger, number, object, oneOf, optional } from "../../lib/schema"
import type { AccountLogExport, ReportLog, ReportSummary } from "./types"

const tools = ["ChatGPT", "Claude", "Gemini", "Other"] as const
const eventTypes = ["sensitive-data", "prompt-injection", "risky-upload", "scam-fraud"] as const
const severities = ["low", "medium", "high"] as const
const decisions = ["warned", "blocked", "ignored", "allowed", "redacted-copied"] as const
const feedback = ["correct-warning", "false-alarm", "missed-risk"] as const

const countMap = <T extends string>(value: unknown, keys: readonly T[]): Record<T, number> => {
  const input = object(value, keys)
  return Object.fromEntries(keys.map((key) => [key, nonNegativeInteger(input[key])])) as Record<T, number>
}
export const parseReportLog = (value: unknown): ReportLog => {
  const input = object(value, ["extensionLogId", "timestamp", "tool", "hostname", "eventType", "severity", "decision", "title", "redactedSnippet", "evidence", "createdAt"], ["id", "feedback"])
  return {
    id: optional(input.id, (item) => nonEmptyString(item, 64)), extensionLogId: nonEmptyString(input.extensionLogId, 120), timestamp: isoDate(input.timestamp),
    tool: oneOf(input.tool, tools), hostname: nonEmptyString(input.hostname, 180), eventType: oneOf(input.eventType, eventTypes), severity: oneOf(input.severity, severities), decision: oneOf(input.decision, decisions),
    feedback: optional(input.feedback, (item) => oneOf(item, feedback)), title: nonEmptyString(input.title, 160), redactedSnippet: nonEmptyString(input.redactedSnippet, 500),
    evidence: array(input.evidence, (item) => nonEmptyString(item, 100), 8), createdAt: isoDate(input.createdAt)
  }
}
export const parseReportSummary = (value: unknown): ReportSummary => {
  const input = object(value, ["totalLogs", "feedbackTotal", "falseAlarmRate", "missedRiskRate", "byFeedback", "bySeverity", "byEventType", "byDecision", "byHostname"])
  const hostnames = dictionary(input.byHostname)
  return {
    totalLogs: nonNegativeInteger(input.totalLogs), feedbackTotal: nonNegativeInteger(input.feedbackTotal), falseAlarmRate: number(input.falseAlarmRate), missedRiskRate: number(input.missedRiskRate),
    byFeedback: countMap(input.byFeedback, feedback), bySeverity: countMap(input.bySeverity, severities), byEventType: countMap(input.byEventType, eventTypes), byDecision: countMap(input.byDecision, decisions),
    byHostname: Object.fromEntries(Object.entries(hostnames).map(([key, count]) => [nonEmptyString(key, 180), nonNegativeInteger(count)]))
  }
}
export const parseLogsResponse = (value: unknown) => { const input = object(value, ["logs"]); return { logs: array(input.logs, parseReportLog, 10_000) } }
export const parseSummaryResponse = (value: unknown) => { const input = object(value, ["summary"]); return { summary: parseReportSummary(input.summary) } }
export const parseAccountLogExport = (value: unknown): AccountLogExport => {
  const input = object(value, ["exportedAt", "privacy", "logs"])
  return { exportedAt: isoDate(input.exportedAt), privacy: nonEmptyString(input.privacy, 200), logs: array(input.logs, parseReportLog, 10_000) }
}
