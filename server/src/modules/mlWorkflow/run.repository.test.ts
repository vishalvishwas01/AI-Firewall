import assert from "node:assert/strict"
import test from "node:test"

import { ensureTrainingRunIndexes, transitionTrainingRun } from "./run.repository.js"

test("training run indexes protect identity, selection, and expiry", async () => {
  const indexes: unknown[][] = []
  const db = { collection: () => ({ createIndex: async (...args: unknown[]) => { indexes.push(args) } }) } as unknown
  await ensureTrainingRunIndexes(db as never)
  assert.deepEqual(indexes[0], [{ runId: 1 }, { unique: true }])
  assert.deepEqual(indexes[1], [{ triggerId: 1 }, { unique: true }])
  assert.deepEqual(indexes[2], [{ state: 1, createdAt: -1 }])
  assert.deepEqual(indexes[3], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }])
})

test("stale training-run transitions are rejected without mutation", async () => {
  let update: unknown[] | undefined
  const db = { collection: () => ({ updateOne: async (...args: unknown[]) => { update = args; return { matchedCount: 0 } } }) } as unknown
  const transitioned = await transitionTrainingRun(db as never, "run-a3-001", 2, "training")
  assert.equal(transitioned, false)
  assert.deepEqual(update?.[0], { runId: "run-a3-001", recordVersion: 2 })
})
