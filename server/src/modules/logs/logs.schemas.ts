import type { AiTool, DetectionCategory, Severity, UserDecision, WarningFeedback } from "../../models/syncedLog.js"
import { maxRedactedSnippetLength, validateRedactedSnippetForStorage } from "../../utils/redactionPolicy.js"
import { exactObject } from "../../shared/validation.js"
import { ValidationError } from "../../shared/errors.js"

export const tools = ["ChatGPT", "Claude", "Gemini", "Other"] as const
export const eventTypes = ["sensitive-data", "prompt-injection", "risky-upload", "scam-fraud"] as const
export const severities = ["low", "medium", "high"] as const
export const decisions = ["warned", "blocked", "ignored", "allowed", "redacted-copied"] as const
export const warningFeedback = ["correct-warning", "false-alarm", "missed-risk"] as const

export const isOneOf = <T extends readonly string[]>(value: unknown, allowed: T): value is T[number] =>
  typeof value === "string" && allowed.includes(value)

export const parseDate = (value: unknown) => {
  if (typeof value !== "string" || !value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export const normalizeHostname = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase().replace(/^www\./, "") : ""

export const parseLogQuery = (value: unknown, includeLimit: boolean) => {
  const query = exactObject(value, includeLimit ? ["tool", "hostname", "from", "to", "limit"] : ["tool", "hostname", "from", "to"], "Invalid log query")
  const tool = query.tool === undefined ? undefined : isOneOf(query.tool, tools) ? query.tool : (() => { throw new ValidationError("Invalid log query") })()
  const hostname = query.hostname === undefined ? undefined : normalizeHostname(query.hostname)
  if (query.hostname !== undefined && (!hostname || hostname.length > 180)) throw new ValidationError("Invalid log query")
  const from = query.from === undefined ? undefined : parseDate(query.from)
  const to = query.to === undefined ? undefined : parseDate(query.to)
  if ((query.from !== undefined && !from) || (query.to !== undefined && !to) || (from && to && from > to)) throw new ValidationError("Invalid log query")
  let limit = 100
  if (includeLimit && query.limit !== undefined) {
    const parsed = typeof query.limit === "string" && /^\d{1,3}$/.test(query.limit) ? Number(query.limit) : Number.NaN
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) throw new ValidationError("Invalid log query")
    limit = parsed
  }
  return { tool, hostname, from, to, limit }
}

export type ParsedLogInput = {
  extensionLogId: string
  timestamp: Date
  tool: AiTool
  hostname: string
  eventType: DetectionCategory
  severity: Severity
  decision: UserDecision
  feedback?: WarningFeedback
  title: string
  redactedSnippet: string
  evidence: string[]
}

export const parseLogInput = (bodyValue: unknown): ParsedLogInput | { error: string } => {
  const body = exactObject(bodyValue, ["extensionLogId", "timestamp", "tool", "hostname", "eventType", "severity", "decision", "feedback", "title", "redactedSnippet", "evidence"], "Invalid log request")
  const extensionLogId = typeof body.extensionLogId === "string" ? body.extensionLogId.trim() : ""
  const timestamp = parseDate(body.timestamp)
  const tool = isOneOf(body.tool, tools) ? body.tool as AiTool : undefined
  const hostname = typeof body.hostname === "string" ? body.hostname.trim() : ""
  const eventType = isOneOf(body.eventType, eventTypes) ? body.eventType as DetectionCategory : undefined
  const severity = isOneOf(body.severity, severities) ? body.severity as Severity : undefined
  const decision = isOneOf(body.decision, decisions) ? body.decision as UserDecision : undefined
  const feedback = isOneOf(body.feedback, warningFeedback) ? body.feedback as WarningFeedback : undefined
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const redactedSnippet = typeof body.redactedSnippet === "string"
    ? body.redactedSnippet.trim()
    : ""
  if (body.feedback !== undefined && !feedback) return { error: "Invalid log fields" }
  if (body.evidence !== undefined && (!Array.isArray(body.evidence) || body.evidence.length > 8 || body.evidence.some((item) => typeof item !== "string" || !item.trim() || item.trim().length > 100))) {
    return { error: "Invalid log fields" }
  }
  const evidence = Array.isArray(body.evidence) ? body.evidence.map((item) => (item as string).trim()) : []

  if (!extensionLogId || extensionLogId.length > 120 || !timestamp || !tool || !hostname || hostname.length > 180 || !eventType || !severity || !decision || !title || title.length > 160 || !redactedSnippet) {
    return { error: "Missing required log fields" }
  }
  const snippetValidation = validateRedactedSnippetForStorage(redactedSnippet)
  if (!snippetValidation.valid) return { error: snippetValidation.error ?? "Redacted snippet is not safe to store" }
  return { extensionLogId, timestamp, tool, hostname, eventType, severity, decision, ...(feedback ? { feedback } : {}), title, redactedSnippet, evidence }
}

export const isParsedLogInput = (value: ParsedLogInput | { error: string }): value is ParsedLogInput => !("error" in value)
