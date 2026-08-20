import type { Collection, Db, ObjectId } from "mongodb"

import type { TrainingFailureCode, TrainingRunState } from "./workflow.types.js"

export type TrainingRunDocument = {
  _id?: ObjectId
  runId: string
  triggerId: string
  inputDigest: string
  runProfileId: "profile-logistic-v1"
  state: TrainingRunState
  recordVersion: number
  createdAt: Date
  startedAt: Date | null
  finishedAt: Date | null
  expiresAt: Date
  runnerVersion: string
  evidenceDigest: string | null
  candidateDigest: string | null
  failureCode: TrainingFailureCode | null
}

export type CreateTrainingRunInput = Omit<TrainingRunDocument, "_id" | "recordVersion" | "createdAt" | "expiresAt"> & {
  createdAt?: Date
  expiresAt?: Date
}

export const trainingRunsCollection = (db: Db): Collection<TrainingRunDocument> => db.collection<TrainingRunDocument>("ml_training_runs")

export const ensureTrainingRunIndexes = async (db: Db) => {
  const collection = trainingRunsCollection(db)
  await collection.createIndex({ runId: 1 }, { unique: true })
  await collection.createIndex({ triggerId: 1 }, { unique: true })
  await collection.createIndex({ state: 1, createdAt: -1 })
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}

export const createTrainingRun = async (db: Db, input: CreateTrainingRunInput): Promise<TrainingRunDocument> => {
  const createdAt = input.createdAt ?? new Date()
  const expiresAt = input.expiresAt ?? new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)
  const collection = trainingRunsCollection(db)
  const run: TrainingRunDocument = { ...input, createdAt, expiresAt, recordVersion: 1 }
  await collection.insertOne(run)
  return run
}

export const findTrainingRun = (db: Db, runId: string) => trainingRunsCollection(db).findOne({ runId })
export const findTrainingRunByTrigger = (db: Db, triggerId: string) => trainingRunsCollection(db).findOne({ triggerId })

export const findTrainingRuns = (db: Db, limit = 50) => trainingRunsCollection(db)
  .find({}, { sort: { createdAt: -1 }, limit })
  .toArray()

export const transitionTrainingRun = async (
  db: Db,
  runId: string,
  expectedRecordVersion: number,
  state: TrainingRunState,
  patch: Partial<Pick<TrainingRunDocument, "startedAt" | "finishedAt" | "evidenceDigest" | "candidateDigest" | "failureCode">> = {}
): Promise<boolean> => {
  const result = await trainingRunsCollection(db).updateOne(
    { runId, recordVersion: expectedRecordVersion },
    { $set: { state, ...patch, recordVersion: expectedRecordVersion + 1 } }
  )
  return result.matchedCount === 1
}
