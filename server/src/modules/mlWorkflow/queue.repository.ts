import type { Collection, Db, ObjectId } from "mongodb"

export type MlQueueStatus = "queued" | "leased" | "completed" | "dead-letter"

export type MlQueueJobDocument = {
  _id?: ObjectId
  jobId: string
  runId: string
  status: MlQueueStatus
  attempts: number
  maxAttempts: 3
  availableAt: Date
  leaseExpiresAt: Date | null
  leasedBy: string | null
  failureCode: "runner-unavailable" | "resource-limit" | "unknown" | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
}

const workerId = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/

export const mlQueueCollection = (db: Db): Collection<MlQueueJobDocument> => db.collection<MlQueueJobDocument>("ml_training_queue")

export const ensureMlQueueIndexes = async (db: Db) => {
  const collection = mlQueueCollection(db)
  await collection.createIndex({ jobId: 1 }, { unique: true })
  await collection.createIndex({ runId: 1 }, { unique: true })
  await collection.createIndex({ status: 1, availableAt: 1, leaseExpiresAt: 1 })
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}

export const enqueueMlRun = async (db: Db, runId: string, now = new Date()): Promise<MlQueueJobDocument> => {
  const collection = mlQueueCollection(db)
  await collection.updateOne(
    { runId },
    { $setOnInsert: { jobId: `job-${runId}`, runId, status: "queued", attempts: 0, maxAttempts: 3, availableAt: now, leaseExpiresAt: null, leasedBy: null, failureCode: null, createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } },
    { upsert: true }
  )
  const job = await collection.findOne({ runId })
  if (!job) throw new Error("ML queue job could not be loaded")
  return job
}

export const leaseNextMlRun = async (db: Db, leasedBy: string, now = new Date(), leaseSeconds = 300) => {
  if (!workerId.test(leasedBy) || !Number.isInteger(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > 1800) throw new Error("ML queue lease is invalid")
  return mlQueueCollection(db).findOneAndUpdate(
    {
      attempts: { $lt: 3 },
      $or: [
        { status: "queued", availableAt: { $lte: now } },
        { status: "leased", leaseExpiresAt: { $lte: now } }
      ]
    },
    { $set: { status: "leased", leasedBy, leaseExpiresAt: new Date(now.getTime() + leaseSeconds * 1000), updatedAt: now }, $inc: { attempts: 1 } },
    { sort: { availableAt: 1, createdAt: 1 }, returnDocument: "after" }
  )
}

export const completeMlQueueJob = async (db: Db, jobId: string, leasedBy: string, now = new Date()) => {
  const result = await mlQueueCollection(db).updateOne(
    { jobId, status: "leased", leasedBy, leaseExpiresAt: { $gt: now } },
    { $set: { status: "completed", leasedBy: null, leaseExpiresAt: null, failureCode: null, updatedAt: now } }
  )
  return result.matchedCount === 1
}

export const failMlQueueJob = async (db: Db, job: MlQueueJobDocument, leasedBy: string, failureCode: MlQueueJobDocument["failureCode"], now = new Date()) => {
  if (failureCode === null) throw new Error("ML queue failure code is required")
  const deadLetter = job.attempts >= job.maxAttempts
  const result = await mlQueueCollection(db).updateOne(
    { jobId: job.jobId, status: "leased", leasedBy },
    { $set: { status: deadLetter ? "dead-letter" : "queued", availableAt: new Date(now.getTime() + Math.min(60 * 2 ** job.attempts, 900) * 1000), leasedBy: null, leaseExpiresAt: null, failureCode, updatedAt: now } }
  )
  return { updated: result.matchedCount === 1, deadLetter }
}
