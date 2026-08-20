import type { Db } from "mongodb"

import { appendMlAuditEvent } from "./audit.repository.js"
import { completeMlQueueJob, failMlQueueJob, leaseNextMlRun } from "./queue.repository.js"
import { findTrainingRun, transitionTrainingRun } from "./run.repository.js"
import { executeIsolatedRunner, type IsolatedRunner } from "./runner.adapter.js"
import { withMlTransaction } from "./transaction.js"

/**
 * Processes at most one queued training run. The coordinator deliberately
 * accepts only the injected isolated runner; it cannot invoke a shell,
 * provider, or arbitrary tool itself.
 */
export const processNextMlRun = async (
  db: Db,
  workerId: string,
  runner: IsolatedRunner,
  options: { leaseSeconds?: number; timeoutMs?: number; now?: Date } = {}
) => {
  const now = options.now ?? new Date()
  const job = await leaseNextMlRun(db, workerId, now, options.leaseSeconds ?? 300)
  if (!job) return { status: "idle" as const }

  let current = await findTrainingRun(db, job.runId)
  if (!current) {
    return { status: "orphaned" as const, runId: job.runId }
  }

  if (current.state === "queued") {
    if (!await transitionTrainingRun(db, job.runId, current.recordVersion, "validating", { startedAt: now })) {
      return { status: "stale" as const, runId: job.runId }
    }
    await appendMlAuditEvent(db, {
      eventId: `audit-${job.runId}-validating-${current.recordVersion + 1}`,
      eventType: "run-transitioned", actorUserId: null, runId: job.runId,
      candidateDigest: null, evidenceDigest: null, recordVersion: current.recordVersion + 1,
      metadata: { fromState: "queued", toState: "validating" }
    }, now)
    current = await findTrainingRun(db, job.runId)
    if (!current) return { status: "stale" as const, runId: job.runId }
  }

  if (current.state === "validating") {
    if (!await transitionTrainingRun(db, job.runId, current.recordVersion, "training")) {
      return { status: "stale" as const, runId: job.runId }
    }
    await appendMlAuditEvent(db, {
      eventId: `audit-${job.runId}-training-${current.recordVersion + 1}`,
      eventType: "run-transitioned", actorUserId: null, runId: job.runId,
      candidateDigest: null, evidenceDigest: null, recordVersion: current.recordVersion + 1,
      metadata: { fromState: "validating", toState: "training" }
    }, now)
    current = await findTrainingRun(db, job.runId)
    if (!current) return { status: "stale" as const, runId: job.runId }
  }

  // A retry resumes the same immutable run from training; it must not replay
  // earlier state transitions or create duplicate audit events.
  if (current.state !== "training") return { status: "stale" as const, runId: job.runId }

  let result: { status: "completed"; candidateDigest: string; evidenceDigest: string } | { status: "retry" | "dead-letter"; failureCode: "resource-limit" | "runner-unavailable" }
  try {
    const output = await executeIsolatedRunner(job.runId, runner, options.timeoutMs ?? 900_000)
    result = { status: "completed", ...output }
  } catch (error) {
    const failureCode = error instanceof Error && error.message === "ML runner timeout" ? "resource-limit" as const : "runner-unavailable" as const
    if (job.attempts >= job.maxAttempts) {
      await withMlTransaction(db, async (session) => {
        const failed = await failMlQueueJob(db, job, workerId, failureCode, now, session)
        if (!failed.updated || !failed.deadLetter) throw new Error("ML queue dead-letter transition was lost")
        const current = await findTrainingRun(db, job.runId)
        if (!current || !await transitionTrainingRun(db, job.runId, current.recordVersion, "failed", { finishedAt: now, failureCode }, session)) throw new Error("ML run failure transition was lost")
        await appendMlAuditEvent(db, {
          eventId: `audit-${job.runId}-failed-${current.recordVersion + 1}`,
          eventType: "run-transitioned", actorUserId: null, runId: job.runId,
          candidateDigest: current.candidateDigest, evidenceDigest: current.evidenceDigest, recordVersion: current.recordVersion + 1,
          metadata: { fromState: current.state, toState: "failed", failureCode }
        }, now, session)
      })
      return { status: "dead-letter" as const, runId: job.runId, failureCode }
    }
    await failMlQueueJob(db, job, workerId, failureCode, now)
    result = { status: "retry", failureCode }
  }
  if (result.status !== "completed") {
    return { status: result.status, runId: job.runId, failureCode: result.failureCode }
  }

  const outcome = await withMlTransaction(db, async (session) => {
    const evaluating = await findTrainingRun(db, job.runId)
    if (!evaluating || evaluating.state !== "training") throw new Error("ML run changed before evaluation")
    if (!await transitionTrainingRun(db, job.runId, evaluating.recordVersion, "evaluating", { candidateDigest: result.candidateDigest, evidenceDigest: result.evidenceDigest }, session)) throw new Error("ML run changed before evaluation")
    await appendMlAuditEvent(db, {
      eventId: `audit-${job.runId}-evaluating-${evaluating.recordVersion + 1}`,
      eventType: "run-transitioned", actorUserId: null, runId: job.runId,
      candidateDigest: result.candidateDigest, evidenceDigest: result.evidenceDigest, recordVersion: evaluating.recordVersion + 1,
      metadata: { fromState: "training", toState: "evaluating" }
    }, now, session)
    const completed = await findTrainingRun(db, job.runId)
    if (!completed || completed.state !== "evaluating" || !await transitionTrainingRun(db, job.runId, completed.recordVersion, "awaiting_review", {}, session)) throw new Error("ML run changed before review")
    await appendMlAuditEvent(db, {
      eventId: `audit-${job.runId}-awaiting-review-${completed.recordVersion + 1}`,
      eventType: "run-transitioned", actorUserId: null, runId: job.runId,
      candidateDigest: result.candidateDigest, evidenceDigest: result.evidenceDigest, recordVersion: completed.recordVersion + 1,
      metadata: { fromState: "evaluating", toState: "awaiting_review" }
    }, now, session)
    if (!await completeMlQueueJob(db, job.jobId, workerId, now, session)) throw new Error("ML queue lease was lost before completion")
    return { status: "awaiting_review" as const }
  })
  return { ...outcome, runId: job.runId, candidateDigest: result.candidateDigest, evidenceDigest: result.evidenceDigest }
}
