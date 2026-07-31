import type { Detection, UserDecision, WarningFeedback } from "../../firewall/types"

/** Contracts shared by warning presenters and the DOM adapter. */
export type WarningActionLabel = "paste" | "message" | "upload"

export type WarningContext = {
  detection: Detection
  sourceText: string
  actionLabel: WarningActionLabel
}

export type WarningOutcome = {
  decision: UserDecision
  feedback?: WarningFeedback
}

export type { WarningAnalysis } from "./analysis"
