import type {
  CandidateClassification,
  ClassifierState,
  DetectionAction,
  ShadowAgreement,
  ShadowComparison
} from "./contracts"

const actionRank: Record<DetectionAction, number> = { allow: 0, warn: 1, redact: 2, confirm: 2, block: 3 }

export const classifierShadowAction = (
  classifications: CandidateClassification[]
): DetectionAction => {
  if (classifications.some((item) => item.band === "high")) return "confirm"
  if (classifications.some((item) => item.band === "medium")) return "warn"
  return "allow"
}

const agreementFor = (
  ruleAction: DetectionAction,
  classifierAction: DetectionAction
): ShadowAgreement => {
  if (ruleAction === classifierAction) return "same-action"
  return actionRank[classifierAction] > actionRank[ruleAction]
    ? "classifier-higher"
    : "rule-higher"
}

export const buildShadowComparison = (
  ruleAction: DetectionAction,
  candidateCount: number,
  classifications: CandidateClassification[],
  classifier: ClassifierState
): ShadowComparison => {
  if (!classifier.available) {
    return {
      status: "unavailable",
      ruleAction,
      candidateCount,
      mediumCandidateCount: 0,
      highCandidateCount: 0,
      reason: classifier.reason
    }
  }

  const classifierAction = classifierShadowAction(classifications)
  return {
    status: "observed",
    ruleAction,
    classifierAction,
    agreement: agreementFor(ruleAction, classifierAction),
    candidateCount,
    mediumCandidateCount: classifications.filter((item) => item.band === "medium").length,
    highCandidateCount: classifications.filter((item) => item.band === "high").length,
    modelVersion: classifier.artifact.modelVersion
  }
}
