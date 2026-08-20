import assert from "node:assert/strict"
import test from "node:test"

import { executeLeasedMlJob } from "./runner.adapter.js"
import type { MlQueueJobDocument } from "./queue.repository.js"

const job = { jobId: "job-run-001", runId: "run-001", status: "leased", attempts: 1, maxAttempts: 3, leasedBy: "worker-001", leaseExpiresAt: new Date("2099-01-01T00:00:00Z") } as MlQueueJobDocument

test("injected isolated runner completes only with digest output", async () => {
  const db = { collection: () => ({ updateOne: async () => ({ matchedCount: 1 }) }) } as unknown
  const result = await executeLeasedMlJob(db as never, job, "worker-001", async () => ({ candidateDigest: "a".repeat(64), evidenceDigest: "b".repeat(64) }), 1000)
  assert.equal(result.status, "completed")
})

test("runner failure is retried without shell or provider fallback", async () => {
  const db = { collection: () => ({ updateOne: async () => ({ matchedCount: 1 }) }) } as unknown
  const result = await executeLeasedMlJob(db as never, job, "worker-001", async () => { throw new Error("unavailable") }, 1000)
  assert.equal(result.status, "retry")
  assert.equal(result.failureCode, "runner-unavailable")
})
