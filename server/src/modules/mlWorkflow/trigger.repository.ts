import type { Collection, Db, ObjectId } from "mongodb"

import type { TrainingTriggerStatus, TrainingTriggerType } from "./workflow.types.js"

export type TrainingTriggerDocument = {
  _id?: ObjectId
  requestedBy: ObjectId
  triggerId: string
  triggerType: TrainingTriggerType
  requestedAt: Date
  inputDigest: string
  runProfileId: string
  reasonCode: string
  networkRequired: false
  status: TrainingTriggerStatus
  expiresAt: Date
}

export type CreateTrainingTriggerInput = Omit<TrainingTriggerDocument, "_id" | "requestedAt" | "expiresAt"> & {
  requestedAt?: Date
  expiresAt?: Date
}

export const trainingTriggersCollection = (db: Db): Collection<TrainingTriggerDocument> =>
  db.collection<TrainingTriggerDocument>("ml_training_triggers")

export const ensureTrainingTriggerIndexes = async (db: Db) => {
  const collection = trainingTriggersCollection(db)
  await collection.createIndex({ requestedBy: 1, triggerId: 1 }, { unique: true })
  await collection.createIndex({ status: 1, requestedAt: -1 })
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}

export const recordTrainingTrigger = async (db: Db, input: CreateTrainingTriggerInput) => {
  const collection = trainingTriggersCollection(db)
  const requestedAt = input.requestedAt ?? new Date()
  const expiresAt = input.expiresAt ?? new Date(requestedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
  await collection.updateOne(
    { requestedBy: input.requestedBy, triggerId: input.triggerId },
    {
      $setOnInsert: {
        requestedBy: input.requestedBy,
        triggerId: input.triggerId,
        triggerType: input.triggerType,
        requestedAt,
        inputDigest: input.inputDigest,
        runProfileId: input.runProfileId,
        reasonCode: input.reasonCode,
        networkRequired: false,
        status: input.status,
        expiresAt
      }
    },
    { upsert: true }
  )
  const stored = await collection.findOne({ requestedBy: input.requestedBy, triggerId: input.triggerId })
  if (!stored) throw new Error("Training trigger could not be loaded")
  return stored
}

export const findTrainingTrigger = (db: Db, requestedBy: ObjectId, triggerId: string) =>
  trainingTriggersCollection(db).findOne({ requestedBy, triggerId })
