import type { Collection, Db, ObjectId } from "mongodb"

export type Severity = "low" | "medium" | "high"
export type DetectionCategory = "sensitive-data" | "prompt-injection" | "risky-upload" | "scam-fraud"
export type UserDecision = "warned" | "blocked" | "ignored" | "allowed" | "redacted-copied"
export type WarningFeedback = "correct-warning" | "false-alarm" | "missed-risk"
export type AiTool = "ChatGPT" | "Claude" | "Gemini" | "Other"

export type SyncedLogDocument = {
  _id?: ObjectId
  extensionLogId: string
  userId: ObjectId
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
  is_Deleted: boolean
  deletedAt?: Date
  createdAt: Date
}

export const syncedLogsCollection = (db: Db): Collection<SyncedLogDocument> =>
  db.collection<SyncedLogDocument>("synced_logs")

export const ensureSyncedLogIndexes = async (db: Db) => {
  const logs = syncedLogsCollection(db)
  await logs.updateMany({ is_Deleted: { $exists: false } }, { $set: { is_Deleted: false } })
  await logs.createIndex({ userId: 1, is_Deleted: 1, timestamp: -1 })
  await logs.createIndex({ userId: 1, tool: 1, is_Deleted: 1, timestamp: -1 })
  await logs.createIndex(
    { userId: 1, extensionLogId: 1 },
    { unique: true }
  )
}
