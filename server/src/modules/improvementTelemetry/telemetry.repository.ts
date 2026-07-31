import type { Db, ObjectId } from "mongodb"
import type { ImprovementEventDocument, ImprovementEventInput } from "./telemetry.types.js"

export const improvementEventsCollection = (db: Db) => db.collection<ImprovementEventDocument>("improvement_events")

export const ensureImprovementTelemetryIndexes = async (db: Db) => {
  const collection = improvementEventsCollection(db)
  await collection.createIndex({ userId: 1, eventId: 1 }, { unique: true })
  await collection.createIndex({ userId: 1, timestamp: -1 })
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}

export const upsertImprovementEvent = async (db: Db, userId: ObjectId, input: ImprovementEventInput) => {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  await improvementEventsCollection(db).updateOne(
    { userId, eventId: input.eventId },
    { $setOnInsert: { userId, createdAt: now, expiresAt }, $set: input },
    { upsert: true }
  )
}

export const listImprovementEvents = (db: Db, userId: ObjectId) => improvementEventsCollection(db).find({ userId }).sort({ timestamp: -1 }).limit(1000).toArray()
export const deleteImprovementEvents = (db: Db, userId: ObjectId) => improvementEventsCollection(db).deleteMany({ userId })
