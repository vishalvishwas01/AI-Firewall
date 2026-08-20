import assert from "node:assert/strict"
import test from "node:test"

import { ensureTrainingEvidenceIndexes, recordTrainingEvidence } from "./evidence.repository.js"
import type { TrainingEvidence } from "./workflow.types.js"

const evidence = (): TrainingEvidence => ({
  contractVersion: "hallguard-ai-training-evidence-v1" as const, runId: "run-a3-001", evidenceDigest: "a".repeat(64), baselineModelVersion: "secret-logistic-b2-limited-v1", candidateModelVersion: "secret-logistic-b2-limited-v1", datasetManifestDigest: "b".repeat(64), runProfileDigest: "c".repeat(64), sourceRevisionDigest: "d".repeat(64), artifactDigest: "e".repeat(64), artifactBytes: 1600,
  metrics: { recall: 1, falseNegativeRate: 0, falsePositiveRate: 0, precision: 1, calibrationError: 0.01, support: 208 },
  gates: { allPassed: false, criticalRecall: true, benignFalsePositive: true, rawLeakFree: true, performancePassed: false, calibrationSufficient: true },
  compatibility: { minExtensionVersion: "0.1.0", maxExtensionVersion: "0.1.99", requiredCapabilities: ["rules-v1", "model-v2", "candidate-features-v1"] }, reproducibility: { rerunMatched: true, seed: 20260801, dependencyLockDigest: "f".repeat(64) }, generatedAt: "2026-08-20T00:00:00Z", retentionExpiresAt: "2026-09-19T00:00:00Z"
})

test("training evidence indexes protect digest identity and expiry", async () => {
  const indexes: unknown[][] = []
  const db = { collection: () => ({ createIndex: async (...args: unknown[]) => { indexes.push(args) } }) } as unknown
  await ensureTrainingEvidenceIndexes(db as never)
  assert.deepEqual(indexes[0], [{ evidenceDigest: 1 }, { unique: true }])
  assert.deepEqual(indexes[1], [{ runId: 1 }, { unique: true }])
  assert.deepEqual(indexes[2], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }])
})

test("recording identical evidence is idempotent and changed evidence is rejected", async () => {
  const value = evidence()
  let stored: Record<string, unknown> | null = null
  const db = { collection: () => ({ findOne: async () => stored, insertOne: async (item: Record<string, unknown>) => { stored = item } }) } as unknown
  const first = await recordTrainingEvidence(db as never, value, new Date("2026-08-20T00:00:00Z"))
  const second = await recordTrainingEvidence(db as never, value, new Date("2026-08-20T00:01:00Z"))
  assert.equal(first.createdAt.toISOString(), second.createdAt.toISOString())
  await assert.rejects(() => recordTrainingEvidence(db as never, { ...value, evidenceDigest: "9".repeat(64) }), /immutable/)
})

test("prohibited content-bearing evidence fields are rejected", async () => {
  const value = evidence() as Record<string, unknown>
  value.prompt = "forbidden"
  await assert.rejects(() => recordTrainingEvidence({ collection: () => ({ findOne: async () => null, insertOne: async () => undefined }) } as never, value as never), /prohibited field/)
})
