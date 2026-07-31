import type { Db, ObjectId } from "mongodb"
import type { ImprovementEventInput } from "./telemetry.types.js"
import { deleteImprovementEvents, listImprovementEvents, upsertImprovementEvent } from "./telemetry.repository.js"

export const saveImprovementEvent = (db: Db, userId: ObjectId, input: ImprovementEventInput) => upsertImprovementEvent(db, userId, input)
export const exportImprovementEvents = async (db: Db, userId: ObjectId) => (await listImprovementEvents(db, userId)).map((event) => ({ eventId: event.eventId, timestamp: event.timestamp.toISOString(), features: event.features, predictedCategory: event.predictedCategory, confidenceBand: event.confidenceBand, feedback: event.feedback, ruleSetVersion: event.ruleSetVersion, modelVersion: event.modelVersion, actionOutcome: event.actionOutcome, createdAt: event.createdAt.toISOString(), expiresAt: event.expiresAt.toISOString() }))
export const clearImprovementEvents = (db: Db, userId: ObjectId) => deleteImprovementEvents(db, userId)
