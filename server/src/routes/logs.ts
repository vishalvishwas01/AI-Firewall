import { Router } from "express"

import { getDb } from "../db/mongo.js"
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js"
import {
  syncedLogsCollection,
  type AiTool,
  type DetectionCategory,
  type Severity,
  type SyncedLogDocument,
  type UserDecision,
  type WarningFeedback
} from "../models/syncedLog.js"
import {
  maxRedactedSnippetLength,
  validateRedactedSnippetForStorage
} from "../utils/redactionPolicy.js"

const router = Router()

const tools = ["ChatGPT", "Claude", "Gemini", "Other"] as const
const eventTypes = ["sensitive-data", "prompt-injection", "risky-upload", "scam-fraud"] as const
const severities = ["low", "medium", "high"] as const
const decisions = ["warned", "blocked", "ignored", "allowed", "redacted-copied"] as const
const warningFeedback = ["correct-warning", "false-alarm", "missed-risk"] as const

const isOneOf = <T extends readonly string[]>(value: unknown, allowed: T): value is T[number] =>
  typeof value === "string" && allowed.includes(value)

const parseDate = (value: unknown) => {
  if (typeof value !== "string" || !value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const normalizeHostname = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase().replace(/^www\./, "").slice(0, 180) : ""

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const buildLogQuery = (req: AuthenticatedRequest) => {
  const tool = req.query.tool
  const hostname = normalizeHostname(req.query.hostname)
  const from = parseDate(req.query.from)
  const to = parseDate(req.query.to)
  const query: Record<string, unknown> = { userId: req.user?.id }

  if (isOneOf(tool, tools)) {
    query.tool = tool
  }

  if (hostname) {
    query.hostname = { $regex: `(^|\\.)${escapeRegex(hostname)}$` }
  }

  if (from || to) {
    query.timestamp = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {})
    }
  }

  return query
}

const emptyCountMap = <T extends readonly string[]>(items: T) =>
  Object.fromEntries(items.map((item) => [item, 0])) as Record<T[number], number>

const publicLog = (log: SyncedLogDocument) => ({
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

router.use(requireAuth)

router.get("/summary", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    const query = buildLogQuery(req)
    const db = await getDb()
    const logs = await syncedLogsCollection(db)
      .find(query, {
        projection: {
          feedback: 1,
          severity: 1,
          eventType: 1,
          decision: 1,
          hostname: 1
        }
      })
      .toArray()

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

      if (log.feedback) {
        byFeedback[log.feedback] += 1
      }
    }

    const feedbackTotal = Object.values(byFeedback).reduce((sum, count) => sum + count, 0)
    const falseAlarmRate =
      feedbackTotal === 0 ? 0 : Number((byFeedback["false-alarm"] / feedbackTotal).toFixed(4))
    const missedRiskRate =
      feedbackTotal === 0 ? 0 : Number((byFeedback["missed-risk"] / feedbackTotal).toFixed(4))

    res.json({
      summary: {
        totalLogs: logs.length,
        feedbackTotal,
        falseAlarmRate,
        missedRiskRate,
        byFeedback,
        bySeverity,
        byEventType,
        byDecision,
        byHostname
      }
    })
  } catch (error) {
    next(error)
  }
})

router.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 200)
    const query = buildLogQuery(req)

    const db = await getDb()
    const logs = await syncedLogsCollection(db)
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    res.json({ logs: logs.map(publicLog) })
  } catch (error) {
    next(error)
  }
})

router.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    const body = req.body as Record<string, unknown>
    const extensionLogId =
      typeof body.extensionLogId === "string" ? body.extensionLogId.trim() : ""
    const timestamp = parseDate(body.timestamp)
    const tool = isOneOf(body.tool, tools) ? (body.tool as AiTool) : undefined
    const hostname =
      typeof body.hostname === "string" ? body.hostname.trim().slice(0, 180) : ""
    const eventType = isOneOf(body.eventType, eventTypes)
      ? (body.eventType as DetectionCategory)
      : undefined
    const severity = isOneOf(body.severity, severities)
      ? (body.severity as Severity)
      : undefined
    const decision = isOneOf(body.decision, decisions)
      ? (body.decision as UserDecision)
      : undefined
    const feedback = isOneOf(body.feedback, warningFeedback)
      ? (body.feedback as WarningFeedback)
      : undefined
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : ""
    const redactedSnippet =
      typeof body.redactedSnippet === "string"
        ? body.redactedSnippet.trim().slice(0, maxRedactedSnippetLength + 1)
        : ""
    const evidence = Array.isArray(body.evidence)
      ? body.evidence
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().slice(0, 100))
          .filter(Boolean)
          .slice(0, 8)
      : []

    if (
      !extensionLogId ||
      !timestamp ||
      !tool ||
      !hostname ||
      !eventType ||
      !severity ||
      !decision ||
      !title ||
      !redactedSnippet
    ) {
      res.status(400).json({ error: "Missing required log fields" })
      return
    }

    const snippetValidation = validateRedactedSnippetForStorage(redactedSnippet)
    if (!snippetValidation.valid) {
      res.status(400).json({ error: snippetValidation.error })
      return
    }

    const now = new Date()
    const db = await getDb()
    const logs = syncedLogsCollection(db)
    await logs.updateOne(
      { userId: req.user.id, extensionLogId },
      {
        $setOnInsert: {
          extensionLogId,
          userId: req.user.id,
          createdAt: now
        },
        $set: {
          timestamp,
          tool,
          hostname,
          eventType,
          severity,
          decision,
          ...(feedback ? { feedback } : {}),
          title,
          redactedSnippet,
          evidence
        }
      },
      { upsert: true }
    )

    const saved = await logs.findOne({ userId: req.user.id, extensionLogId })
    if (!saved) {
      throw new Error("Synced log could not be loaded")
    }

    res.status(201).json({ log: publicLog(saved) })
  } catch (error) {
    next(error)
  }
})

export const logsRouter = router
