import type { Db } from "mongodb"

import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js"
import { findTrainingRun, transitionTrainingRun } from "./run.repository.js"
import { findReleaseEligibleRecord } from "./release-eligibility.repository.js"

export type AdminReviewInput = {
  runId: string
  candidateDigest: string
  evidenceDigest: string
  decision: "approve" | "deny"
  comment: string | null
  reviewerUserId: string
  expectedRecordVersion: number
}

export type AuthorizationContext = {
  authenticated: boolean
  platformRole: string
}

const digest = /^[a-f0-9]{64}$/
const id = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/
const comment = (value: string | null) => value === null || (typeof value === "string" && value.length <= 2000 && !/[\u0000-\u001f\u007f]/.test(value))

export const submitAdminReview = async (db: Db, auth: AuthorizationContext, input: AdminReviewInput): Promise<{ status: "approved" | "denied" }> => {
  if (!auth.authenticated || auth.platformRole !== "super_admin") throw new AuthorizationError("Platform administrator authorization required")
  if (!id.test(input.runId) || !id.test(input.reviewerUserId) || !digest.test(input.candidateDigest) || !digest.test(input.evidenceDigest)) throw new ValidationError("Review identifiers are invalid")
  if (!comment(input.comment) || !Number.isSafeInteger(input.expectedRecordVersion) || input.expectedRecordVersion < 1) throw new ValidationError("Review input is invalid")
  const run = await findTrainingRun(db, input.runId)
  if (!run) throw new NotFoundError("Training run not found")
  if (run.state !== "awaiting_review") throw new ConflictError("Training run is not awaiting review")
  if (run.candidateDigest !== input.candidateDigest || run.evidenceDigest !== input.evidenceDigest) throw new ConflictError("Review digest does not match immutable run evidence")
  if (run.recordVersion !== input.expectedRecordVersion) throw new ConflictError("Stale training run review")
  if (input.decision === "approve") {
    const eligibility = await findReleaseEligibleRecord(db, input.runId, input.candidateDigest, input.evidenceDigest)
    if (!eligibility) throw new ConflictError("Approval requires a separately validated release-eligible evidence record")
  }
  const nextState = input.decision === "approve" ? "approved" : "denied"
  const transitioned = await transitionTrainingRun(db, input.runId, input.expectedRecordVersion, nextState, { finishedAt: new Date() })
  if (!transitioned) throw new ConflictError("Training run changed before review was recorded")
  return { status: nextState }
}
