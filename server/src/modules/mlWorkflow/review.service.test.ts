import assert from "node:assert/strict"
import test from "node:test"

import { submitAdminReview } from "./review.service.js"

const run = { runId: "run-a3-001", state: "awaiting_review" as const, recordVersion: 1, candidateDigest: "a".repeat(64), evidenceDigest: "b".repeat(64) }
const auth = { authenticated: true, platformRole: "super_admin" }
const input = { runId: run.runId, candidateDigest: run.candidateDigest, evidenceDigest: run.evidenceDigest, decision: "deny" as const, comment: "insufficient evidence", reviewerUserId: "admin-001", expectedRecordVersion: 1 }

test("unauthorized admin review is rejected", async () => {
  await assert.rejects(() => submitAdminReview({} as never, { authenticated: false, platformRole: "super_admin" }, input), /authorization/)
})

test("approval is fail-closed until release-eligible evidence is validated", async () => {
  const db = { collection: (name: string) => ({ findOne: async () => name === "ml_training_runs" ? run : null }) } as unknown
  await assert.rejects(() => submitAdminReview(db as never, auth, { ...input, decision: "approve" }), /release-eligible/)
})

test("approval succeeds only with a separately validated digest-bound eligibility record", async () => {
  const calls: unknown[][] = []
  const eligibility = { runId: run.runId, candidateDigest: run.candidateDigest, evidenceDigest: run.evidenceDigest, releaseEligible: true, status: "release-eligible" }
  const db = { collection: (name: string) => ({
    findOne: async () => name === "ml_training_runs" ? run : (name === "ml_release_eligibility" ? eligibility : null),
    insertOne: async () => undefined,
    updateOne: async (...args: unknown[]) => { calls.push(args); return { matchedCount: 1 } }
  }) } as unknown
  const result = await submitAdminReview(db as never, auth, { ...input, decision: "approve" })
  assert.deepEqual(result, { status: "approved" })
  assert.equal((calls[0]?.[1] as { $set: { state: string } }).$set.state, "approved")
})

test("denial binds digests and uses optimistic concurrency", async () => {
  const calls: unknown[][] = []
  const db = { collection: (name: string) => ({ findOne: async () => name === "ml_training_runs" ? run : null, insertOne: async () => undefined, updateOne: async (...args: unknown[]) => { calls.push(args); return { matchedCount: 1 } } }) } as unknown
  const result = await submitAdminReview(db as never, auth, input)
  assert.deepEqual(result, { status: "denied" })
  assert.deepEqual(calls[0]?.[0], { runId: run.runId, recordVersion: 1 })
})

test("stale or mismatched review cannot mutate a run", async () => {
  const db = { collection: () => ({ findOne: async () => run }) } as unknown
  await assert.rejects(() => submitAdminReview(db as never, auth, { ...input, expectedRecordVersion: 2 }), /stale/i)
  await assert.rejects(() => submitAdminReview(db as never, auth, { ...input, candidateDigest: "c".repeat(64) }), /digest/i)
})
