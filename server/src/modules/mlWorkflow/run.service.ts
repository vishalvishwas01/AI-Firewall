import { createHash } from "node:crypto"

import type { Db, ObjectId } from "mongodb"

import { appendMlAuditEvent } from "./audit.repository.js"
import { enqueueMlRun } from "./queue.repository.js"
import { createTrainingRun, findTrainingRunByTrigger, findTrainingRuns } from "./run.repository.js"
import type { ManualTrainingTriggerRequest } from "./trigger.schemas.js"
import { submitManualTrainingTrigger } from "./trigger.service.js"
import type { AiWorkflowConfig } from "./workflow.policy.js"
import { withMlTransaction } from "./transaction.js"

const runIdFor = (requestedBy: ObjectId, triggerId: string) => `run-${createHash("sha256").update(`${requestedBy.toHexString()}:${triggerId}`).digest("hex").slice(0, 32)}`

export const requestManualTrainingRun = async (db: Db, requestedBy: ObjectId, request: ManualTrainingTriggerRequest, config: AiWorkflowConfig, now = new Date()) => {
  const recent = await findTrainingRuns(db, 100)
  const today = new Date(now); today.setUTCHours(0, 0, 0, 0)
  const trigger = await submitManualTrainingTrigger(db, requestedBy, request, config, {
    activeRunCount: recent.filter((run) => !["failed", "denied", "stable"].includes(run.state)).length,
    runsStartedToday: recent.filter((run) => run.createdAt >= today).length,
    history: recent.map((run) => ({ inputDigest: run.inputDigest, runProfileId: run.runProfileId, state: run.state, startedAt: run.startedAt?.toISOString() ?? null })),
    stableInputDigest: null
  }, now)
  if (trigger.status !== "eligible") return { trigger, run: null }
  const existing = await findTrainingRunByTrigger(db, trigger.triggerId)
  if (existing) return { trigger, run: existing }
  const runId = runIdFor(requestedBy, trigger.triggerId)
  const run = await withMlTransaction(db, async (session) => {
    const created = await createTrainingRun(db, {
      runId, triggerId: trigger.triggerId, inputDigest: trigger.inputDigest, runProfileId: "profile-logistic-v1",
      state: "queued", startedAt: null, finishedAt: null, runnerVersion: "hallguard-a3-runner-v1",
      evidenceDigest: null, candidateDigest: null, failureCode: null, createdAt: now
    }, session)
    await enqueueMlRun(db, runId, now, session)
    await appendMlAuditEvent(db, {
      eventId: `audit-${runId}-created`, eventType: "run-created", actorUserId: requestedBy.toHexString(), runId,
      candidateDigest: null, evidenceDigest: null, recordVersion: 1,
      metadata: { triggerId: trigger.triggerId, reasonCode: trigger.reasonCode, runProfileId: trigger.runProfileId }
    }, now, session)
    return created
  })
  return { trigger, run }
}
