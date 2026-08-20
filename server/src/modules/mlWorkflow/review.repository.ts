import { createHash } from "node:crypto"
import type { ClientSession, Collection, Db, ObjectId } from "mongodb"

export type MlReviewDecision = "approve" | "deny"
export type MlReviewDecisionDocument = {
  _id?: ObjectId
  decisionId: string
  runId: string
  candidateDigest: string
  evidenceDigest: string
  decision: MlReviewDecision
  comment: string | null
  reviewerUserId: string
  expectedRecordVersion: number
  resultingRecordVersion: number
  createdAt: Date
  expiresAt: Date
}

const id = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/
const digest = /^[a-f0-9]{64}$/

export const mlReviewDecisionsCollection = (db: Db): Collection<MlReviewDecisionDocument> => db.collection<MlReviewDecisionDocument>("ml_workflow_review_decisions")

export const ensureMlReviewDecisionIndexes = async (db: Db) => {
  const collection = mlReviewDecisionsCollection(db)
  await collection.createIndex({ decisionId: 1 }, { unique: true })
  await collection.createIndex({ runId: 1, expectedRecordVersion: 1 }, { unique: true })
  await collection.createIndex({ reviewerUserId: 1, createdAt: -1 })
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}

export const reviewDecisionId = (runId: string, reviewerUserId: string, expectedRecordVersion: number) =>
  `decision-${createHash("sha256").update(`${runId}:${reviewerUserId}:${expectedRecordVersion}`).digest("hex").slice(0, 32)}`

const validate = (value: MlReviewDecisionDocument) => {
  if (!id.test(value.decisionId) || !id.test(value.runId) || !id.test(value.reviewerUserId)) throw new Error("ML review decision identity is invalid")
  if (!digest.test(value.candidateDigest) || !digest.test(value.evidenceDigest)) throw new Error("ML review decision digest is invalid")
  if (!["approve", "deny"].includes(value.decision) || !Number.isSafeInteger(value.expectedRecordVersion) || value.expectedRecordVersion < 1 || value.resultingRecordVersion !== value.expectedRecordVersion + 1) throw new Error("ML review decision version is invalid")
  if (value.comment !== null && (value.comment.length > 2000 || /[\u0000-\u001f\u007f]/.test(value.comment))) throw new Error("ML review decision comment is invalid")
}

export const recordMlReviewDecision = async (db: Db, input: Omit<MlReviewDecisionDocument, "_id" | "decisionId" | "createdAt" | "expiresAt">, now = new Date(), session?: ClientSession) => {
  const document: MlReviewDecisionDocument = { ...input, decisionId: reviewDecisionId(input.runId, input.reviewerUserId, input.expectedRecordVersion), createdAt: now, expiresAt: new Date(now.getTime() + 730 * 24 * 60 * 60 * 1000) }
  validate(document)
  const collection = mlReviewDecisionsCollection(db)
  const existing = await collection.findOne({ decisionId: document.decisionId }, { session })
  if (existing) {
    if (existing.runId !== document.runId || existing.candidateDigest !== document.candidateDigest || existing.evidenceDigest !== document.evidenceDigest || existing.decision !== document.decision || existing.reviewerUserId !== document.reviewerUserId) throw new Error("ML review decision replay mismatch")
    return existing
  }
  await collection.insertOne(document, { session })
  return document
}
