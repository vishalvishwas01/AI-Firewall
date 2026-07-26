import type { DetectionCategory, Severity, WarningFeedback } from "../models/syncedLog.js"

export const organizationTrendRangeDays = [7, 30, 90] as const
export type OrganizationTrendDays = (typeof organizationTrendRangeDays)[number]

const severities: Severity[] = ["low", "medium", "high"]
const eventTypes: DetectionCategory[] = [
  "sensitive-data",
  "prompt-injection",
  "risky-upload",
  "scam-fraud"
]
const feedbackTypes: WarningFeedback[] = ["correct-warning", "false-alarm", "missed-risk"]

const emptyCounts = <T extends string>(values: T[]) =>
  Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>

export type OrganizationTrendPoint = {
  date: string
  totalLogs: number
  bySeverity: Record<Severity, number>
  byEventType: Record<DetectionCategory, number>
  byFeedback: Record<WarningFeedback, number>
}

export const normalizeOrganizationTrendDays = (value: unknown): OrganizationTrendDays => {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN
  return organizationTrendRangeDays.includes(parsed as OrganizationTrendDays)
    ? (parsed as OrganizationTrendDays)
    : 30
}

export const createOrganizationTrendWindow = (
  days: OrganizationTrendDays,
  now = new Date()
) => {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - days)
  const points = new Map<string, OrganizationTrendPoint>()

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(from)
    date.setUTCDate(date.getUTCDate() + offset)
    const key = date.toISOString().slice(0, 10)
    points.set(key, {
      date: key,
      totalLogs: 0,
      bySeverity: emptyCounts(severities),
      byEventType: emptyCounts(eventTypes),
      byFeedback: emptyCounts(feedbackTypes)
    })
  }

  return { from, to, points }
}

export const addLogToOrganizationTrend = (
  points: Map<string, OrganizationTrendPoint>,
  log: {
    timestamp: Date
    severity: Severity
    eventType: DetectionCategory
    feedback?: WarningFeedback
  }
) => {
  const point = points.get(log.timestamp.toISOString().slice(0, 10))
  if (!point) return

  point.totalLogs += 1
  point.bySeverity[log.severity] += 1
  point.byEventType[log.eventType] += 1
  if (log.feedback) point.byFeedback[log.feedback] += 1
}
