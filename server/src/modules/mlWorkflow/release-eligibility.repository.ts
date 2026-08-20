import type { Collection, Db, ObjectId } from "mongodb"

import { findTrainingEvidence } from "./evidence.repository.js"

export const REQUIRED_A4_GATES = [
  "balanced-benign-evaluation",
  "calibration-report",
  "deterministic-training-state",
  "extension-bundle-growth-benchmark",
  "extension-candidate-explosion-bound",
  "extension-latency-benchmark",
  "held-out-group-isolation",
  "oldest-supported-extension-compatibility",
  "raw-leak-scan",
  "stable-model-comparison",
  "supported-category-evaluation",
  "unicode-normalization-and-adversarial-evaluation"
] as const

export type A4GateId = typeof REQUIRED_A4_GATES[number]
export type A4GateStatus = "passed" | "failed" | "insufficient-evidence"

export type ReleaseEligibilityInput = {
  runId: string
  candidateDigest: string
  evidenceDigest: string
  evaluationDigest: string
  policyId: "a4-evaluation-gates-v1"
  gateResults: Record<A4GateId, A4GateStatus>
}

export type ReleaseEligibilityDocument = ReleaseEligibilityInput & {
  _id?: ObjectId
  contractVersion: "hallguard-ai-release-eligibility-v1"
  releaseEligible: boolean
  status: "release-eligible" | "shadow-only"
  validatedAt: Date
  expiresAt: Date
}

const id = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/
const digest = /^[a-f0-9]{64}$/

export const releaseEligibilityCollection = (db: Db): Collection<ReleaseEligibilityDocument> => db.collection<ReleaseEligibilityDocument>("ml_release_eligibility")

export const ensureReleaseEligibilityIndexes = async (db: Db) => {
  const collection = releaseEligibilityCollection(db)
  await collection.createIndex({ runId: 1 }, { unique: true })
  await collection.createIndex({ candidateDigest: 1, evidenceDigest: 1 }, { unique: true })
  await collection.createIndex({ releaseEligible: 1, validatedAt: -1 })
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}

const validateInput = (input: ReleaseEligibilityInput) => {
  if (!id.test(input.runId) || input.policyId !== "a4-evaluation-gates-v1") throw new Error("A4 release eligibility identity is invalid")
  for (const value of [input.candidateDigest, input.evidenceDigest, input.evaluationDigest]) if (!digest.test(value)) throw new Error("A4 release eligibility digest is invalid")
  const keys = Object.keys(input.gateResults).sort()
  const required = [...REQUIRED_A4_GATES].sort()
  if (keys.length !== required.length || keys.some((key, index) => key !== required[index])) throw new Error("A4 release eligibility gate set is invalid")
  if (Object.values(input.gateResults).some((status) => !["passed", "failed", "insufficient-evidence"].includes(status))) throw new Error("A4 release eligibility gate status is invalid")
}

export const recordReleaseEligibility = async (db: Db, input: ReleaseEligibilityInput, now = new Date()): Promise<ReleaseEligibilityDocument> => {
  validateInput(input)
  const evidence = await findTrainingEvidence(db, input.runId)
  if (!evidence || evidence.evidenceDigest !== input.evidenceDigest || evidence.artifactDigest !== input.candidateDigest) throw new Error("A4 report does not bind the immutable training evidence")
  const evidenceGatesPassed = evidence.gates.allPassed && Object.values(evidence.gates).every((value) => value === true)
  const releaseEligible = evidenceGatesPassed && REQUIRED_A4_GATES.every((gate) => input.gateResults[gate] === "passed")
  const document: ReleaseEligibilityDocument = {
    ...input,
    contractVersion: "hallguard-ai-release-eligibility-v1",
    releaseEligible,
    status: releaseEligible ? "release-eligible" : "shadow-only",
    validatedAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  }
  const collection = releaseEligibilityCollection(db)
  const existing = await collection.findOne({ runId: input.runId })
  if (existing) {
    if (existing.candidateDigest !== input.candidateDigest || existing.evidenceDigest !== input.evidenceDigest || existing.evaluationDigest !== input.evaluationDigest) throw new Error("A4 release eligibility record is immutable")
    return existing
  }
  await collection.insertOne(document)
  return document
}

export const findReleaseEligibleRecord = (db: Db, runId: string, candidateDigest: string, evidenceDigest: string) => releaseEligibilityCollection(db).findOne({
  runId, candidateDigest, evidenceDigest, releaseEligible: true, status: "release-eligible"
})

export const findReleaseEligibilityForRun = (db: Db, runId: string) => releaseEligibilityCollection(db).findOne({ runId }, { sort: { validatedAt: -1 } })
