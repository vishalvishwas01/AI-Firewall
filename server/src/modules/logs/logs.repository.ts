import type { Db, Filter, ObjectId } from "mongodb"

import { syncedLogsCollection, type SyncedLogDocument } from "../../models/syncedLog.js"
import type { ParsedLogInput } from "./logs.schemas.js"

export const findSummaryLogs = (db: Db, filter: Filter<SyncedLogDocument>) =>
  syncedLogsCollection(db).find({ $and: [filter, { is_Deleted: { $ne: true } }] }, { projection: { feedback: 1, severity: 1, eventType: 1, decision: 1, hostname: 1 } }).toArray()

export const findLogs = (db: Db, filter: Filter<SyncedLogDocument>, limit?: number) => {
  const cursor = syncedLogsCollection(db).find({ $and: [filter, { is_Deleted: { $ne: true } }] }).sort({ timestamp: -1 })
  return (limit === undefined ? cursor : cursor.limit(limit)).toArray()
}

export const saveLog = async (db: Db, userId: ObjectId, input: ParsedLogInput) => {
  const logs = syncedLogsCollection(db)
  const now = new Date()
  await logs.updateOne(
    { userId, extensionLogId: input.extensionLogId },
    {
      $setOnInsert: { extensionLogId: input.extensionLogId, userId, is_Deleted: false, createdAt: now },
      $set: {
        timestamp: input.timestamp,
        tool: input.tool,
        hostname: input.hostname,
        eventType: input.eventType,
        severity: input.severity,
        decision: input.decision,
        ...(input.feedback ? { feedback: input.feedback } : {}),
        title: input.title,
        redactedSnippet: input.redactedSnippet,
        evidence: input.evidence
      }
    },
    { upsert: true }
  )
  const saved = await logs.findOne({ userId, extensionLogId: input.extensionLogId })
  if (!saved) throw new Error("Synced log could not be loaded")
  return saved
}
