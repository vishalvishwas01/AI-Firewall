import assert from "node:assert/strict"
import test from "node:test"

import { ensureReleaseEligibilityIndexes, recordReleaseEligibility, REQUIRED_A4_GATES, type A4GateStatus } from "./release-eligibility.repository.js"
import type { TrainingEvidenceDocument } from "./evidence.repository.js"

const evidence = {
  runId: "run-a3-001", evidenceDigest: "b".repeat(64), artifactDigest: "a".repeat(64),
  gates: { allPassed: true, criticalRecall: true, benignFalsePositive: true, rawLeakFree: true, performancePassed: true, calibrationSufficient: true }
} as TrainingEvidenceDocument

const input = (status: A4GateStatus = "passed") => ({
  runId: evidence.runId,
  candidateDigest: evidence.artifactDigest,
  evidenceDigest: evidence.evidenceDigest,
  evaluationDigest: "c".repeat(64),
  policyId: "a4-evaluation-gates-v1" as const,
  gateResults: Object.fromEntries(REQUIRED_A4_GATES.map((gate) => [gate, status])) as Record<typeof REQUIRED_A4_GATES[number], A4GateStatus>
})

const database = () => {
  let eligibility: Record<string, unknown> | null = null
  return { collection: (name: string) => {
    if (name === "ml_training_evidence") return { findOne: async () => evidence }
    if (name === "ml_release_eligibility") return {
      findOne: async () => eligibility,
      insertOne: async (value: Record<string, unknown>) => { eligibility = value },
      createIndex: async () => undefined
    }
    throw new Error(`unexpected collection ${name}`)
  } }
}

test("release eligibility indexes bind runs, digests, selection, and expiry", async () => {
  const indexes: unknown[][] = []
  await ensureReleaseEligibilityIndexes({ collection: () => ({ createIndex: async (...args: unknown[]) => { indexes.push(args) } }) } as never)
  assert.deepEqual(indexes[0], [{ runId: 1 }, { unique: true }])
  assert.deepEqual(indexes[1], [{ candidateDigest: 1, evidenceDigest: 1 }, { unique: true }])
  assert.deepEqual(indexes[3], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }])
})

test("all required A4 gates and immutable evidence produce release eligibility", async () => {
  const result = await recordReleaseEligibility(database() as never, input(), new Date("2026-08-20T00:00:00Z"))
  assert.equal(result.releaseEligible, true)
  assert.equal(result.status, "release-eligible")
})

test("missing evidence or one insufficient gate remains shadow-only", async () => {
  const insufficient = input()
  insufficient.gateResults["stable-model-comparison"] = "insufficient-evidence"
  const result = await recordReleaseEligibility(database() as never, insufficient)
  assert.equal(result.releaseEligible, false)
  assert.equal(result.status, "shadow-only")

  const noEvidence = { collection: (name: string) => name === "ml_training_evidence" ? { findOne: async () => null } : { findOne: async () => null, insertOne: async () => undefined } }
  await assert.rejects(() => recordReleaseEligibility(noEvidence as never, input()), /immutable training evidence/)
})

test("unknown or incomplete A4 gate sets fail closed", async () => {
  const incomplete = input() as unknown as { gateResults: Record<string, A4GateStatus> }
  delete incomplete.gateResults[REQUIRED_A4_GATES[0]]
  await assert.rejects(() => recordReleaseEligibility(database() as never, incomplete as never), /gate set/)
})
