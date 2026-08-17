import { Router } from "express"
import { ObjectId, type Filter } from "mongodb"

import { getDb } from "../../db/mongo.js"
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js"
import type { SyncedLogDocument } from "../../models/syncedLog.js"
import { exactObject, sendJson, validateNoQuery } from "../../shared/validation.js"
import { findLogs, findSummaryLogs, saveLog } from "./logs.repository.js"
import {
  isParsedLogInput,
  parseLogInput,
  parseLogQuery
} from "./logs.schemas.js"
import { summarizeLogs, toPublicLog } from "./logs.service.js"
import { requireAccountExperience, requireFeature } from "../featureFlags/featureFlags.middleware.js"
import { generateLogsPdf } from "./report.service.js"
import { syncedLogsCollection } from "../../models/syncedLog.js"
import { ValidationError } from "../../shared/errors.js"

const router = Router()

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const buildLogQueryForUser = (value: unknown, userId: ObjectId, includeLimit: boolean) => {
  const parsed = parseLogQuery(value, includeLimit)
  const query: Filter<SyncedLogDocument> = { userId }

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

const buildLogQuery = (req: AuthenticatedRequest, includeLimit: boolean) => {
  if (!req.user) throw new ValidationError("Authenticated user missing")
  return buildLogQueryForUser(req.query, req.user.id, includeLimit)
}

router.use(requireAuth)

router.get("/summary", requireAccountExperience, requireFeature("reports"), async (req: AuthenticatedRequest, res, next) => {
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

router.get("/export", requireAccountExperience, requireFeature("reports"), validateNoQuery, async (req: AuthenticatedRequest, res, next) => {
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

router.get("/pdf", requireAccountExperience, requireFeature("reports"), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) return next(new ValidationError("Authenticated user missing"))
    const { query } = buildLogQuery(req, false)
    const logs = await findLogs(await getDb(), query)
    if (logs.length === 0) {
      res.status(409).json({ error: "No logs are available for this report", code: "no_logs_available" })
      return
    }
    const filterLabel = [
      typeof req.query.hostname === "string" ? req.query.hostname : "",
      typeof req.query.tool === "string" ? req.query.tool : "",
      typeof req.query.from === "string" ? `from ${req.query.from}` : "",
      typeof req.query.to === "string" ? `to ${req.query.to}` : ""
    ].filter(Boolean).join(" - ")
    const pdf = await generateLogsPdf({ logs, accountEmail: req.user.email, filterLabel })
    const date = new Date().toISOString().slice(0, 10)
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="hallguard-report-${date}.pdf"`)
    res.setHeader("Content-Length", pdf.length)
    res.send(pdf)
  } catch (error) {
    next(error)
  }
})

router.post("/delete", requireAccountExperience, requireFeature("reports"), validateNoQuery, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) return next(new ValidationError("Authenticated user missing"))
    const body = exactObject(req.body, [], ["ids", "all", "filters"], "Invalid log deletion request")
    let query: Filter<SyncedLogDocument>
    if (body.all === true) {
      if (body.ids !== undefined) throw new ValidationError("Choose selected logs or all matching logs")
      query = buildLogQueryForUser(body.filters ?? {}, req.user.id, false).query
    } else {
      const ids = body.ids
      if (body.all !== undefined || body.filters !== undefined || !Array.isArray(ids) || ids.length < 1 || ids.length > 200 || ids.some((id) => typeof id !== "string" || !ObjectId.isValid(id))) {
        throw new ValidationError("Invalid selected logs")
      }
      query = { userId: req.user.id, _id: { $in: ids.map((id) => new ObjectId(id as string)) } }
    }
    const result = await syncedLogsCollection(await getDb()).updateMany(
      { $and: [query, { is_Deleted: { $ne: true } }] },
      { $set: { is_Deleted: true, deletedAt: new Date() } }
    )
    sendJson(res, ["deletedCount"], { deletedCount: result.modifiedCount })
  } catch (error) {
    next(error)
  }
})

router.get("/", requireAccountExperience, requireFeature("reports"), async (req: AuthenticatedRequest, res, next) => {
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
