import type { AiWorkflowConfig } from "./workflow.policy.js"
import type { TrainingRunState, TrainingTriggerType } from "./workflow.types.js"

export type TriggerHistory = {
  inputDigest: string
  runProfileId: string
  state: TrainingRunState
  startedAt: string | null
}

export type TriggerEligibilityInput = {
  triggerType: TrainingTriggerType
  inputDigest: string
  runProfileId: string
  now: Date
  activeRunCount: number
  runsStartedToday: number
  history: TriggerHistory[]
  stableInputDigest: string | null
}

export type TriggerEligibilityDecision = {
  status: "eligible" | "not-needed" | "rejected"
  reasonCode: "manual-admin-approved" | "automatic-triggers-disabled" | "daily-run-budget-exhausted" | "active-run-budget-exhausted" | "cooldown-active" | "duplicate-input" | "stable-input-unchanged"
}

const unfinishedStates = new Set<TrainingRunState>(["queued", "validating", "training", "evaluating", "awaiting_review", "approved", "signing", "publishing", "staged", "canary"])

export const evaluateTrainingTrigger = (config: AiWorkflowConfig, input: TriggerEligibilityInput): TriggerEligibilityDecision => {
  if (input.triggerType !== "manual-admin") return { status: "rejected", reasonCode: "automatic-triggers-disabled" }
  if (input.stableInputDigest === input.inputDigest) return { status: "not-needed", reasonCode: "stable-input-unchanged" }
  if (input.history.some((run) => run.inputDigest === input.inputDigest && run.runProfileId === input.runProfileId && unfinishedStates.has(run.state))) {
    return { status: "not-needed", reasonCode: "duplicate-input" }
  }
  if (input.runsStartedToday >= config.maxRunsPerDay) return { status: "rejected", reasonCode: "daily-run-budget-exhausted" }
  if (input.activeRunCount >= config.maxActiveRuns) return { status: "rejected", reasonCode: "active-run-budget-exhausted" }
  const mostRecentRunAt = input.history
    .map((run) => run.startedAt ? Date.parse(run.startedAt) : Number.NaN)
    .filter(Number.isFinite)
    .reduce<number | undefined>((latest, timestamp) => latest === undefined || timestamp > latest ? timestamp : latest, undefined)
  if (mostRecentRunAt !== undefined && input.now.getTime() - mostRecentRunAt < config.cooldownSeconds * 1000) {
    return { status: "rejected", reasonCode: "cooldown-active" }
  }
  return { status: "eligible", reasonCode: "manual-admin-approved" }
}
