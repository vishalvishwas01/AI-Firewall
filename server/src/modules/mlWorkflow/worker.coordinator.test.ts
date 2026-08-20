import assert from "node:assert/strict"
import test from "node:test"

import type { MlQueueJobDocument } from "./queue.repository.js"
import type { TrainingRunDocument } from "./run.repository.js"
import { processNextMlRun } from "./worker.coordinator.js"

const makeDb = (initialState: TrainingRunDocument["state"] = "queued", attempts = 0) => {
  const run = {
    runId: "run-001", triggerId: "trigger-001", inputDigest: "c".repeat(64), runProfileId: "profile-logistic-v1",
    state: initialState, recordVersion: initialState === "queued" ? 1 : 3, createdAt: new Date(), startedAt: null,
    finishedAt: null, expiresAt: new Date("2099-01-01T00:00:00Z"), runnerVersion: "hallguard-a3-runner-v1",
    evidenceDigest: null, candidateDigest: null, failureCode: null
  } satisfies TrainingRunDocument
  const queue = {
    jobId: "job-run-001", runId: run.runId, status: "queued", attempts, maxAttempts: 3,
    availableAt: new Date("2026-08-20T00:00:00Z"), leaseExpiresAt: null, leasedBy: null, failureCode: null,
    createdAt: new Date("2026-08-20T00:00:00Z"), updatedAt: new Date("2026-08-20T00:00:00Z"), expiresAt: new Date("2099-01-01T00:00:00Z")
  } satisfies MlQueueJobDocument
  const audits: Record<string, unknown>[] = []
  const db = { collection: (name: string) => {
    if (name === "ml_training_runs") return {
      findOne: async ({ runId }: { runId: string }) => runId === run.runId ? { ...run } : null,
      updateOne: async (filter: { runId: string; recordVersion: number }, update: { $set: Partial<TrainingRunDocument> }) => {
        if (filter.runId !== run.runId || filter.recordVersion !== run.recordVersion) return { matchedCount: 0 }
        Object.assign(run, update.$set)
        return { matchedCount: 1 }
      }
    }
    if (name === "ml_training_queue") return {
      findOneAndUpdate: async (_filter: unknown, update: { $set: Partial<MlQueueJobDocument>; $inc: { attempts: number } }) => {
        Object.assign(queue, update.$set)
        queue.attempts += update.$inc.attempts
        return { ...queue }
      },
      updateOne: async (_filter: unknown, update: { $set: Partial<MlQueueJobDocument> }) => {
        Object.assign(queue, update.$set)
        return { matchedCount: 1 }
      }
    }
    if (name === "ml_workflow_audit_events") return { insertOne: async (value: Record<string, unknown>) => { audits.push(value) } }
    throw new Error(`unexpected collection ${name}`)
  } }
  return { db, run, queue, audits }
}

test("worker coordinates an isolated run through awaiting review with digest-bound audits", async () => {
  const context = makeDb()
  const result = await processNextMlRun(context.db as never, "worker-001", async () => ({
    candidateDigest: "a".repeat(64), evidenceDigest: "b".repeat(64)
  }), { now: new Date("2026-08-20T00:00:00Z"), timeoutMs: 1000 })

  assert.equal(result.status, "awaiting_review")
  assert.equal(context.run.state, "awaiting_review")
  assert.equal(context.run.recordVersion, 5)
  assert.equal(context.run.candidateDigest, "a".repeat(64))
  assert.equal(context.queue.status, "completed")
  assert.deepEqual(context.audits.map((event) => event.metadata), [
    { fromState: "queued", toState: "validating" },
    { fromState: "validating", toState: "training" },
    { fromState: "training", toState: "evaluating" },
    { fromState: "evaluating", toState: "awaiting_review" }
  ])
})

test("retry resumes from training without replaying transition audits", async () => {
  const context = makeDb("training")
  const result = await processNextMlRun(context.db as never, "worker-001", async () => { throw new Error("runner unavailable") }, { timeoutMs: 1000 })
  assert.equal(result.status, "retry")
  assert.equal(context.run.state, "training")
  assert.equal(context.audits.length, 0)
})

test("final runner failure atomically dead-letters the queue and fails the run", async () => {
  const context = makeDb("training", 3)
  const result = await processNextMlRun(context.db as never, "worker-001", async () => { throw new Error("runner unavailable") }, { timeoutMs: 1000 })
  assert.equal(result.status, "dead-letter")
  assert.equal(context.queue.status, "dead-letter")
  assert.equal(context.run.state, "failed")
  assert.equal(context.audits.at(-1)?.metadata && (context.audits.at(-1)?.metadata as Record<string, unknown>).toState, "failed")
})
