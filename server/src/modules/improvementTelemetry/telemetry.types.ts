import type { ObjectId } from "mongodb"

export const featureNames = [
  "length", "lengthBucket", "entropy", "letterRatio", "digitRatio",
  "uppercaseRatio", "lowercaseRatio", "punctuationRatio", "separatorRatio",
  "classTransitionRatio", "repeatedCharacterRatio", "safeShape",
  "assignmentContext", "secretKeywordContext", "structuredConfigContext", "pathLike"
] as const

export type ImprovementFeatures = Record<(typeof featureNames)[number], number>
export type ImprovementEventInput = {
  eventId: string
  timestamp: Date
  features: ImprovementFeatures
  predictedCategory: "sensitive-data"
  confidenceBand: "clean" | "medium" | "high"
  feedback?: "correct-warning" | "false-alarm" | "missed-risk"
  ruleSetVersion: string
  modelVersion: string
  actionOutcome: "warned" | "blocked" | "ignored" | "allowed" | "redacted-copied"
}

export type ImprovementEventDocument = ImprovementEventInput & {
  _id?: ObjectId
  userId: ObjectId
  createdAt: Date
  expiresAt: Date
}
