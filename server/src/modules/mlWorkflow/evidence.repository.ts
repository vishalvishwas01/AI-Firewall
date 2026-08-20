import type { Collection, Db, ObjectId } from "mongodb"

import type { TrainingEvidence } from "./workflow.types.js"

export type TrainingEvidenceDocument = TrainingEvidence & {
  _id?: ObjectId
  createdAt: Date
  expiresAt: Date
}

const forbiddenKeys = new Set(["prompt", "text", "snippet", "secret", "fileBody", "dom", "screenshot", "featureVector", "rawContent", "telemetryPayload", "chainOfThought", "candidateValue"])

const inspectKeys = (value: unknown): void => {
  if (Array.isArray(value)) return value.forEach(inspectKeys)
  if (!value || typeof value !== "object") return
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) throw new Error("training evidence contains a prohibited field")
    inspectKeys(child)
  }
}

export const validateTrainingEvidenceDocument = (value: TrainingEvidenceDocument): void => {
  inspectKeys(value)
  if (value.contractVersion !== "hallguard-ai-training-evidence-v1") throw new Error("unsupported training evidence contract")
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(value.runId)) throw new Error("invalid training evidence run id")
  for (const field of ["evidenceDigest", "datasetManifestDigest", "runProfileDigest", "sourceRevisionDigest", "artifactDigest"] as const) {
    if (!/^[a-f0-9]{64}$/.test(value[field])) throw new Error(`invalid training evidence ${field}`)
  }
  if (!Number.isInteger(value.artifactBytes) || value.artifactBytes < 2 || value.artifactBytes > 5242880) throw new Error("training evidence artifact size is invalid")
  if (value.reproducibility.rerunMatched !== true || value.reproducibility.seed !== 20260801) throw new Error("training evidence reproducibility is invalid")
  if (!value.gates.rawLeakFree || !value.gates.criticalRecall || !value.gates.benignFalsePositive) throw new Error("training evidence safety gates are not passed")
}

export const trainingEvidenceCollection = (db: Db): Collection<TrainingEvidenceDocument> => db.collection<TrainingEvidenceDocument>("ml_training_evidence")

export const findTrainingEvidence = (db: Db, runId: string) => trainingEvidenceCollection(db).findOne({ runId })

export const ensureTrainingEvidenceIndexes = async (db: Db) => {
  const collection = trainingEvidenceCollection(db)
  await collection.createIndex({ evidenceDigest: 1 }, { unique: true })
  await collection.createIndex({ runId: 1 }, { unique: true })
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}

export const recordTrainingEvidence = async (db: Db, value: TrainingEvidence, now = new Date()): Promise<TrainingEvidenceDocument> => {
  validateTrainingEvidenceDocument({ ...value, createdAt: now, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) })
  const document: TrainingEvidenceDocument = { ...value, createdAt: now, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) }
  const collection = trainingEvidenceCollection(db)
  const existing = await collection.findOne({ runId: value.runId })
  if (existing) {
    if (existing.evidenceDigest !== value.evidenceDigest) throw new Error("training evidence for run is immutable")
    return existing
  }
  await collection.insertOne(document)
  return document
}
