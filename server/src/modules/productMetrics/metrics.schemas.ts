const names = new Set(["install", "first-protected-session", "first-warning", "first-redaction", "account-connected", "organization-created", "warning", "false-alarm", "missed-risk", "allow-anyway", "redaction-used", "member-invited", "managed-site-configured", "team-event"])
const keys = ["eventId", "timestamp", "name", "count", "extensionVersion", "ruleSetVersion", "modelVersion"] as const

export type ProductMetric = {
  eventId: string
  timestamp: Date
  name: string
  count: number
  extensionVersion?: string
  ruleSetVersion?: string
  modelVersion?: string
}

export const parseProductMetric = (value: unknown): ProductMetric | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const body = value as Record<string, unknown>
  if (Object.keys(body).some((key) => !keys.includes(key as typeof keys[number]))) return undefined
  const timestamp = typeof body.timestamp === "string" ? new Date(body.timestamp) : undefined
  const bounded = (item: unknown) => item === undefined || (typeof item === "string" && /^[a-z0-9._-]{1,80}$/i.test(item))
  if (typeof body.eventId !== "string" || !/^[a-z0-9-]{16,80}$/i.test(body.eventId) || !timestamp || Number.isNaN(timestamp.getTime()) || !names.has(String(body.name)) || !Number.isInteger(body.count) || Number(body.count) < 1 || Number(body.count) > 1000 || !bounded(body.extensionVersion) || !bounded(body.ruleSetVersion) || !bounded(body.modelVersion)) return undefined
  return { eventId: body.eventId, timestamp, name: body.name as string, count: body.count as number, ...(body.extensionVersion ? { extensionVersion: body.extensionVersion as string } : {}), ...(body.ruleSetVersion ? { ruleSetVersion: body.ruleSetVersion as string } : {}), ...(body.modelVersion ? { modelVersion: body.modelVersion as string } : {}) }
}
