import type { ClientSession, Collection, Db, ObjectId } from "mongodb"

export type StagingIntentDocument = {
  _id?: ObjectId
  intentId: string
  runId: string
  candidateDigest: string
  evidenceDigest: string
  channel: "staging"
  packageSequence: number
  status: "staging-pending-signature" | "signed" | "published" | "failed"
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
}

export const stagingIntentsCollection = (db: Db): Collection<StagingIntentDocument> => db.collection<StagingIntentDocument>("ml_staging_release_intents")
export const ensureStagingIntentIndexes = async (db: Db) => {
  const collection = stagingIntentsCollection(db)
  await collection.createIndex({ intentId: 1 }, { unique: true })
  await collection.createIndex({ runId: 1 }, { unique: true })
  await collection.createIndex({ candidateDigest: 1, evidenceDigest: 1 }, { unique: true })
  await collection.createIndex({ status: 1, createdAt: -1 })
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}
export const recordStagingIntent = async (db: Db, input: Omit<StagingIntentDocument, "_id" | "createdAt" | "updatedAt" | "expiresAt">, now = new Date(), session?: ClientSession) => {
  const document: StagingIntentDocument = { ...input, createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) }
  const collection = stagingIntentsCollection(db)
  const existing = await collection.findOne({ runId: input.runId }, { session })
  if (existing) {
    if (existing.candidateDigest !== input.candidateDigest || existing.evidenceDigest !== input.evidenceDigest || existing.packageSequence !== input.packageSequence) throw new Error("staging release intent is immutable")
    return existing
  }
  await collection.insertOne(document, { session })
  return document
}
