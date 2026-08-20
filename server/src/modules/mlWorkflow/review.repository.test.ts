import assert from "node:assert/strict"
import test from "node:test"

import { ensureMlReviewDecisionIndexes, recordMlReviewDecision, reviewDecisionId } from "./review.repository.js"

const input = { runId: "run-001", candidateDigest: "a".repeat(64), evidenceDigest: "b".repeat(64), decision: "deny" as const, comment: "insufficient evidence", reviewerUserId: "admin-001", expectedRecordVersion: 4, resultingRecordVersion: 5 }

test("review decision indexes prevent identity and version replay", async () => {
  const indexes: unknown[][] = []
  await ensureMlReviewDecisionIndexes({ collection: () => ({ createIndex: async (...args: unknown[]) => { indexes.push(args) } }) } as never)
  assert.deepEqual(indexes[0], [{ decisionId: 1 }, { unique: true }])
  assert.deepEqual(indexes[1], [{ runId: 1, expectedRecordVersion: 1 }, { unique: true }])
  assert.deepEqual(indexes[3], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }])
})

test("identical review retries are idempotent and mismatched replay is rejected", async () => {
  let stored: Record<string, unknown> | null = null
  const db = { collection: () => ({ findOne: async () => stored, insertOne: async (value: Record<string, unknown>) => { stored = value } }) } as unknown
  const first = await recordMlReviewDecision(db as never, input, new Date("2026-08-20T00:00:00Z"))
  const second = await recordMlReviewDecision(db as never, input, new Date("2026-08-20T00:01:00Z"))
  assert.equal(first.decisionId, reviewDecisionId(input.runId, input.reviewerUserId, input.expectedRecordVersion))
  assert.equal(first.createdAt.toISOString(), second.createdAt.toISOString())
  await assert.rejects(() => recordMlReviewDecision(db as never, { ...input, decision: "approve" }), /replay mismatch/)
})
