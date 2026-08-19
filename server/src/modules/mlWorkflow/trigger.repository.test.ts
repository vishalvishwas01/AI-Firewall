import assert from "node:assert/strict"
import test from "node:test"
import { ObjectId } from "mongodb"

import { ensureTrainingTriggerIndexes, recordTrainingTrigger } from "./trigger.repository.js"

const input = () => ({
  requestedBy: new ObjectId("64b9523b35795e90949872a1"), triggerId: "trigger-2026-08-20-001", triggerType: "manual-admin" as const,
  inputDigest: "a".repeat(64), runProfileId: "profile-logistic-v1", reasonCode: "manual-admin-approved", networkRequired: false as const, status: "eligible" as const,
  requestedAt: new Date("2026-08-20T01:00:00Z"), expiresAt: new Date("2026-08-27T01:00:00Z")
})

test("training trigger indexes protect idempotency, scheduling, and expiry", async () => {
  const indexes: unknown[][] = []
  const db = { collection: () => ({ createIndex: async (...args: unknown[]) => { indexes.push(args) } }) } as unknown
  await ensureTrainingTriggerIndexes(db as never)
  assert.deepEqual(indexes[0], [{ requestedBy: 1, triggerId: 1 }, { unique: true }])
  assert.deepEqual(indexes[1], [{ status: 1, requestedAt: -1 }])
  assert.deepEqual(indexes[2], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }])
})

test("recording the same request only inserts immutable content-free trigger fields once", async () => {
  const calls: unknown[][] = []
  const value = input()
  const db = {
    collection: () => ({
      updateOne: async (...args: unknown[]) => { calls.push(args) },
      findOne: async () => value
    })
  } as unknown
  const stored = await recordTrainingTrigger(db as never, value)
  assert.equal(stored.triggerId, value.triggerId)
  const [filter, update, options] = calls[0] as [Record<string, unknown>, { $setOnInsert: Record<string, unknown> }, { upsert: boolean }]
  assert.deepEqual(filter, { requestedBy: value.requestedBy, triggerId: value.triggerId })
  assert.equal(options.upsert, true)
  assert.equal(update.$setOnInsert.networkRequired, false)
  assert.equal("prompt" in update.$setOnInsert, false)
  assert.equal("candidate" in update.$setOnInsert, false)
})
