import type { CandidateFeatures } from "../detection"
import type { UserDecision, WarningFeedback } from "../storage"

export type ImprovementEvent = {
  eventId: string
  timestamp: string
  features: CandidateFeatures
  predictedCategory: "sensitive-data"
  confidenceBand: "clean" | "medium" | "high"
  feedback?: WarningFeedback
  ruleSetVersion: string
  modelVersion: string
  actionOutcome: UserDecision
}
