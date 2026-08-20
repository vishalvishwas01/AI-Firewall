import assert from "node:assert/strict"
import test from "node:test"

import { ensureMlQueueIndexes, failMlQueueJob, leaseNextMlRun, type MlQueueJobDocument } from "./queue.repository.js"

test("queue indexes protect idempotency, lease selection, and expiry", async () => {
  const indexes: unknown[][] = []
  await ensureMlQueueIndexes({ collection: () => ({ createIndex: async (...args: unknown[]) => { indexes.push(args) } }) } as never)
  assert.deepEqual(indexes[0], [{ jobId: 1 }, { unique: true }])
  assert.deepEqual(indexes[1], [{ runId: 1 }, { unique: true }])
  assert.deepEqual(indexes[3], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }])
})

test("lease is atomic and bounded", async () => {
  let call: unknown[] | undefined
  const db = { collection: () => ({ findOneAndUpdate: async (...args: unknown[]) => { call = args; return null } }) } as unknown
  await leaseNextMlRun(db as never, "worker-001", new Date("2026-08-20T00:00:00Z"), 300)
  assert.equal((call?.[2] as Record<string, unknown>).returnDocument, "after")
  assert.equal(((call?.[1] as { $inc: { attempts: number } }).$inc.attempts), 1)
})

test("third failed attempt dead-letters the job", async () => {
  const job = { jobId: "job-run-001", runId: "run-001", status: "leased", attempts: 3, maxAttempts: 3 } as MlQueueJobDocument
  const db = { collection: () => ({ updateOne: async () => ({ matchedCount: 1 }) }) } as unknown
  assert.deepEqual(await failMlQueueJob(db as never, job, "worker-001", "runner-unavailable"), { updated: true, deadLetter: true })
})
