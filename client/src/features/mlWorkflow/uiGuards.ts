import type { TrainingRunSummary } from "./types"

export const isValidManualRunInput = (triggerId: string, inputDigest: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(triggerId) && /^[a-f0-9]{64}$/.test(inputDigest)
export const canSubmitReview = (run: TrainingRunSummary | null) => Boolean(run?.state === "awaiting_review" && run.candidateDigest && run.evidenceDigest)
