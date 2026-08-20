import assert from "node:assert/strict"
import test from "node:test"

import { prepareStagingRelease } from "./release.service.js"

const run = { runId: "run-001", state: "approved" as const, candidateDigest: "a".repeat(64), evidenceDigest: "b".repeat(64) }
const eligibility = { runId: run.runId, candidateDigest: run.candidateDigest, evidenceDigest: run.evidenceDigest, releaseEligible: true, status: "release-eligible" }
const db = { collection: (name: string) => ({ findOne: async () => name === "ml_training_runs" ? run : (name === "ml_release_eligibility" ? eligibility : null), insertOne: async () => undefined }) }

test("staging preflight freezes approved digests without signing or publishing", async () => {
  const result = await prepareStagingRelease(db as never, { runId: run.runId, candidateDigest: run.candidateDigest, evidenceDigest: run.evidenceDigest, packageSequence: 1 })
  assert.deepEqual(result, { status: "staging-pending-signature", runId: run.runId, candidateDigest: run.candidateDigest, evidenceDigest: run.evidenceDigest, channel: "staging", packageSequence: 1 })
})

test("staging preflight rejects non-approved or non-eligible candidates", async () => {
  await assert.rejects(() => prepareStagingRelease({ collection: () => ({ findOne: async () => ({ ...run, state: "awaiting_review" }) }) } as never, { runId: run.runId, candidateDigest: run.candidateDigest, evidenceDigest: run.evidenceDigest, packageSequence: 1 }), /approved/)
  await assert.rejects(() => prepareStagingRelease({ collection: (name: string) => ({ findOne: async () => name === "ml_training_runs" ? run : null }) } as never, { runId: run.runId, candidateDigest: run.candidateDigest, evidenceDigest: run.evidenceDigest, packageSequence: 1 }), /release-eligible/)
})
