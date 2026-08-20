import type { ClientSession, Collection, Db, ObjectId } from "mongodb"

export type MlAuditEventType = "trigger-recorded" | "run-created" | "run-transitioned" | "evidence-recorded" | "review-denied" | "review-approved"

export type MlAuditEventDocument = {
  _id?: ObjectId
  eventId: string
  eventType: MlAuditEventType
  actorUserId: string | null
  runId: string | null
  candidateDigest: string | null
  evidenceDigest: string | null
  recordVersion: number
  metadata: Record<string, string | number | boolean | null>
  createdAt: Date
  retentionUntil: Date
}

const id = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/
const digest = /^[a-f0-9]{64}$/
const forbidden = new Set(["prompt", "text", "snippet", "secret", "fileBody", "dom", "screenshot", "featureVector", "rawContent", "telemetryPayload", "chainOfThought", "candidateValue"])

export const validateMlAuditEvent = (value: MlAuditEventDocument): void => {
  if (!id.test(value.eventId) || !["trigger-recorded", "run-created", "run-transitioned", "evidence-recorded", "review-denied", "review-approved"].includes(value.eventType)) throw new Error("ML audit event identity is invalid")
  for (const field of ["actorUserId", "runId"] as const) if (value[field] !== null && !id.test(value[field])) throw new Error(`ML audit event ${field} is invalid`)
  for (const field of ["candidateDigest", "evidenceDigest"] as const) if (value[field] !== null && !digest.test(value[field])) throw new Error(`ML audit event ${field} is invalid`)
  if (!Number.isSafeInteger(value.recordVersion) || value.recordVersion < 1) throw new Error("ML audit event recordVersion is invalid")
  if (!value.metadata || typeof value.metadata !== "object" || Object.keys(value.metadata).length > 16) throw new Error("ML audit event metadata is invalid")
  for (const [key, item] of Object.entries(value.metadata)) {
    if (!id.test(key) || forbidden.has(key) || (item !== null && !["string", "number", "boolean"].includes(typeof item))) throw new Error("ML audit event metadata contains prohibited content")
    if (typeof item === "string" && item.length > 256) throw new Error("ML audit event metadata is oversized")
  }
}

export const mlAuditEventsCollection = (db: Db): Collection<MlAuditEventDocument> => db.collection<MlAuditEventDocument>("ml_workflow_audit_events")

export const ensureMlAuditEventIndexes = async (db: Db) => {
  const collection = mlAuditEventsCollection(db)
  await collection.createIndex({ eventId: 1 }, { unique: true })
  await collection.createIndex({ runId: 1, createdAt: -1 })
  await collection.createIndex({ createdAt: -1 })
  await collection.createIndex({ retentionUntil: 1 }, { expireAfterSeconds: 0 })
}

export const appendMlAuditEvent = async (db: Db, input: Omit<MlAuditEventDocument, "_id" | "createdAt" | "retentionUntil">, now = new Date(), session?: ClientSession) => {
  const document: MlAuditEventDocument = { ...input, createdAt: now, retentionUntil: new Date(now.getTime() + 730 * 24 * 60 * 60 * 1000) }
  validateMlAuditEvent(document)
  await mlAuditEventsCollection(db).insertOne(document, { session })
  return document
}
