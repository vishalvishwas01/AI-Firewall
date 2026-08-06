import type { SyncedLogDocument } from "../../models/syncedLog.js"
import { decisions, eventTypes, severities, warningFeedback } from "./logs.schemas.js"

const emptyCountMap = <T extends readonly string[]>(items: T) =>
  Object.fromEntries(items.map((item) => [item, 0])) as Record<T[number], number>

export const toPublicLog = (log: SyncedLogDocument) => ({
  id: log._id?.toHexString(),
  extensionLogId: log.extensionLogId,
  timestamp: log.timestamp.toISOString(),
  tool: log.tool,
  hostname: log.hostname,
  eventType: log.eventType,
  severity: log.severity,
  decision: log.decision,
  feedback: log.feedback,
  title: log.title,
  redactedSnippet: log.redactedSnippet,
  evidence: log.evidence,
  createdAt: log.createdAt.toISOString()
})

export const summarizeLogs = (logs: SyncedLogDocument[]) => {
  const byFeedback = emptyCountMap(warningFeedback)
  const bySeverity = emptyCountMap(severities)
  const byEventType = emptyCountMap(eventTypes)
  const byDecision = emptyCountMap(decisions)
  const byHostname: Record<string, number> = {}
  for (const log of logs) {
    bySeverity[log.severity] += 1
    byEventType[log.eventType] += 1
    byDecision[log.decision] += 1
    byHostname[log.hostname] = (byHostname[log.hostname] ?? 0) + 1
    if (log.feedback) byFeedback[log.feedback] += 1
  }
  const feedbackTotal = Object.values(byFeedback).reduce((sum, count) => sum + count, 0)
  return {
    totalLogs: logs.length,
    feedbackTotal,
    falseAlarmRate: feedbackTotal === 0 ? 0 : Number((byFeedback["false-alarm"] / feedbackTotal).toFixed(4)),
    missedRiskRate: feedbackTotal === 0 ? 0 : Number((byFeedback["missed-risk"] / feedbackTotal).toFixed(4)),
    byFeedback,
    bySeverity,
    byEventType,
    byDecision,
    byHostname
  }
}
