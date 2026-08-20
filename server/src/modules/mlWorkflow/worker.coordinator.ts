import type { Db } from "mongodb"

import { appendMlAuditEvent } from "./audit.repository.js"
import { leaseNextMlRun } from "./queue.repository.js"
import { findTrainingRun, transitionTrainingRun } from "./run.repository.js"
import { executeLeasedMlJob, type IsolatedRunner } from "./runner.adapter.js"

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

  const result = await executeLeasedMlJob(db, job, workerId, runner, options.timeoutMs ?? 900_000)
  if (result.status !== "completed") {
    const current = await findTrainingRun(db, job.runId)
    if (result.status === "dead-letter" && current && await transitionTrainingRun(db, job.runId, current.recordVersion, "failed", { finishedAt: now, failureCode: result.failureCode })) {
      await appendMlAuditEvent(db, {
        eventId: `audit-${job.runId}-failed-${current.recordVersion + 1}`,
        eventType: "run-transitioned", actorUserId: null, runId: job.runId,
        candidateDigest: null, evidenceDigest: null, recordVersion: current.recordVersion + 1,
        metadata: { fromState: current.state, toState: "failed", failureCode: result.failureCode }
      }, now)
    }
    return { status: result.status, runId: job.runId, failureCode: result.failureCode }
  }

  const evaluating = await findTrainingRun(db, job.runId)
  if (!evaluating || evaluating.state !== "training") return { status: "stale" as const, runId: job.runId }
  if (!await transitionTrainingRun(db, job.runId, evaluating.recordVersion, "evaluating", { candidateDigest: result.candidateDigest, evidenceDigest: result.evidenceDigest })) {
    return { status: "stale" as const, runId: job.runId }
  }
  await appendMlAuditEvent(db, {
    eventId: `audit-${job.runId}-evaluating-${evaluating.recordVersion + 1}`,
    eventType: "run-transitioned", actorUserId: null, runId: job.runId,
    candidateDigest: result.candidateDigest, evidenceDigest: result.evidenceDigest, recordVersion: evaluating.recordVersion + 1,
    metadata: { fromState: "training", toState: "evaluating" }
  }, now)

  const completed = await findTrainingRun(db, job.runId)
  if (!completed || completed.state !== "evaluating" || !await transitionTrainingRun(db, job.runId, completed.recordVersion, "awaiting_review")) {
    return { status: "stale" as const, runId: job.runId }
  }
  await appendMlAuditEvent(db, {
    eventId: `audit-${job.runId}-awaiting-review-${completed.recordVersion + 1}`,
    eventType: "run-transitioned", actorUserId: null, runId: job.runId,
    candidateDigest: result.candidateDigest, evidenceDigest: result.evidenceDigest, recordVersion: completed.recordVersion + 1,
    metadata: { fromState: "evaluating", toState: "awaiting_review" }
  }, now)
  return { status: "awaiting_review" as const, runId: job.runId, candidateDigest: result.candidateDigest, evidenceDigest: result.evidenceDigest }
}
