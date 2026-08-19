import type { Db, ObjectId } from "mongodb"

import { evaluateTrainingTrigger, type TriggerEligibilityInput } from "./trigger.policy.js"
import { findTrainingTrigger, recordTrainingTrigger, type TrainingTriggerDocument } from "./trigger.repository.js"
import type { ManualTrainingTriggerRequest } from "./trigger.schemas.js"
import type { AiWorkflowConfig } from "./workflow.policy.js"

export type ManualTriggerContext = Pick<TriggerEligibilityInput, "activeRunCount" | "runsStartedToday" | "history" | "stableInputDigest">

export const submitManualTrainingTrigger = async (
  db: Db,
  requestedBy: ObjectId,
  request: ManualTrainingTriggerRequest,
  config: AiWorkflowConfig,
  context: ManualTriggerContext,
  now = new Date()
): Promise<TrainingTriggerDocument> => {
  const existing = await findTrainingTrigger(db, requestedBy, request.triggerId)
  if (existing) return existing

  const decision = evaluateTrainingTrigger(config, {
    ...context,
    ...request,
    triggerType: "manual-admin",
    now
  })
  return recordTrainingTrigger(db, {
    requestedBy,
    triggerId: request.triggerId,
    triggerType: "manual-admin",
    requestedAt: now,
    inputDigest: request.inputDigest,
    runProfileId: request.runProfileId,
    reasonCode: decision.reasonCode,
    networkRequired: false,
    status: decision.status
  })
}
