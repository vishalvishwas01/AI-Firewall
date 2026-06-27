import { Router } from "express"

import { getDb } from "../db/mongo.js"
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js"
import {
  syncedLogsCollection,
  type AiTool,
  type DetectionCategory,
  type Severity,
  type SyncedLogDocument,
  type UserDecision
} from "../models/syncedLog.js"

const router = Router()

const tools = ["ChatGPT", "Claude", "Gemini", "Other"] as const
const eventTypes = ["sensitive-data", "prompt-injection", "risky-upload", "scam-fraud"] as const
const severities = ["low", "medium", "high"] as const
const decisions = ["warned", "blocked", "ignored", "allowed", "redacted-copied"] as const
const secretLikePattern =
  /\b(api[_-]?key|access[_-]?token|secret|password|passwd|pwd|token)\b\s*[:=]|(?:sk-|pk_|ghp_|xox[baprs]-|AKIA[0-9A-Z]{8})/i

const isOneOf = <T extends readonly string[]>(value: unknown, allowed: T): value is T[number] =>
  typeof value === "string" && allowed.includes(value)

const parseDate = (value: unknown) => {
  if (typeof value !== "string" || !value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const publicLog = (log: SyncedLogDocument) => ({
  id: log._id?.toHexString(),
  extensionLogId: log.extensionLogId,
  timestamp: log.timestamp.toISOString(),
  tool: log.tool,
  hostname: log.hostname,
  eventType: log.eventType,
  severity: log.severity,
  decision: log.decision,
  title: log.title,
  redactedSnippet: log.redactedSnippet,
  evidence: log.evidence,
  createdAt: log.createdAt.toISOString()
})

router.use(requireAuth)

router.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    const tool = req.query.tool
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to)
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 200)
    const query: Record<string, unknown> = { userId: req.user.id }

    if (isOneOf(tool, tools)) {
      query.tool = tool
    }

    if (from || to) {
      query.timestamp = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {})
      }
    }

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
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : ""
    const redactedSnippet =
      typeof body.redactedSnippet === "string" ? body.redactedSnippet.trim().slice(0, 600) : ""
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

    if (secretLikePattern.test(redactedSnippet)) {
      res.status(400).json({ error: "Log snippet must be redacted before sync" })
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
