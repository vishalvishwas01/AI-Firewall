import { Router } from "express"
import type { Filter } from "mongodb"

import { getDb } from "../../db/mongo.js"
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js"
import type { SyncedLogDocument } from "../../models/syncedLog.js"
import { sendJson, validateNoQuery } from "../../shared/validation.js"
import { findLogs, findSummaryLogs, saveLog } from "./logs.repository.js"
import {
  isParsedLogInput,
  parseLogInput,
  parseLogQuery
} from "./logs.schemas.js"
import { summarizeLogs, toPublicLog } from "./logs.service.js"

const router = Router()

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const buildLogQuery = (req: AuthenticatedRequest, includeLimit: boolean) => {
  const parsed = parseLogQuery(req.query, includeLimit)
  const query: Filter<SyncedLogDocument> = { userId: req.user?.id }

  if (parsed.tool) query.tool = parsed.tool

  if (parsed.hostname) query.hostname = { $regex: `(^|\\.)${escapeRegex(parsed.hostname)}$` }

  if (parsed.from || parsed.to) {
    query.timestamp = {
      ...(parsed.from ? { $gte: parsed.from } : {}),
      ...(parsed.to ? { $lte: parsed.to } : {})
    }
  }

  return { query, limit: parsed.limit }
}

router.use(requireAuth)

router.get("/summary", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    const { query } = buildLogQuery(req, false)
    const db = await getDb()
    const logs = await findSummaryLogs(db, query)
    sendJson(res, ["summary"], { summary: summarizeLogs(logs) })
  } catch (error) {
    next(error)
  }
})

router.get("/export", validateNoQuery, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    const db = await getDb()
    const logs = await findLogs(db, { userId: req.user.id })

    sendJson(res, ["exportedAt", "privacy", "logs"], {
      exportedAt: new Date().toISOString(),
      privacy: "Redacted account-backed warning records only",
      logs: logs.map(toPublicLog)
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

    const { query, limit } = buildLogQuery(req, true)

    const db = await getDb()
    const logs = await findLogs(db, query, limit)

    sendJson(res, ["logs"], { logs: logs.map(toPublicLog) })
  } catch (error) {
    next(error)
  }
})

router.post("/", validateNoQuery, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    const input = parseLogInput(req.body)
    if (!isParsedLogInput(input)) {
      res.status(400).json({ error: input.error })
      return
    }

    const db = await getDb()
    const saved = await saveLog(db, req.user.id, input)

    sendJson(res.status(201), ["log"], { log: toPublicLog(saved) })
  } catch (error) {
    next(error)
  }
})

export const logsRouter = router
