import type { WarningAnalysis } from "../warnings"
import type { UserDecision, WarningFeedback } from "../storage"
import type { ImprovementEvent } from "./contracts"

const coarsenedTimestamp = (now = new Date()) => {
  const value = new Date(now)
  value.setUTCMinutes(0, 0, 0)
  return value.toISOString()
}
const eventId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`

export const improvementEventsFromAnalysis = (
  analysis: WarningAnalysis,
  actionOutcome: UserDecision,
  feedback?: WarningFeedback
): ImprovementEvent[] => {
  const classifications = new Map(analysis.candidateClassifications.map((item) => [item.index, item]))
  return analysis.candidateSignals.flatMap((signal) => {
    const classification = classifications.get(signal.index)
    if (!classification) return []
    return [{
      eventId: eventId(), timestamp: coarsenedTimestamp(), features: signal.features,
      predictedCategory: "sensitive-data" as const, confidenceBand: classification.band,
      ...(feedback ? { feedback } : {}), ruleSetVersion: analysis.ruleSetVersion,
      modelVersion: classification.modelVersion, actionOutcome
    }]
  }).slice(0, 4)
}
