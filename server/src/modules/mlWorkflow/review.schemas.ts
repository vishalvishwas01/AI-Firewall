import { ValidationError } from "../../shared/errors.js"
import { exactObject } from "../../shared/validation.js"
import type { AdminReviewInput } from "./review.service.js"

const digest = /^[a-f0-9]{64}$/
const id = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/

export const parseAdminReviewRequest = (runId: unknown, body: unknown, decision: "approve" | "deny"): AdminReviewInput => {
  const value = exactObject(body, ["candidateDigest", "evidenceDigest", "comment", "expectedRecordVersion"], "Invalid ML review request")
  if (typeof runId !== "string" || !id.test(runId)) throw new ValidationError("Invalid ML run id")
  if (typeof value.candidateDigest !== "string" || !digest.test(value.candidateDigest) || typeof value.evidenceDigest !== "string" || !digest.test(value.evidenceDigest)) throw new ValidationError("Invalid ML review digest")
  if (value.comment !== null && (typeof value.comment !== "string" || value.comment.length > 2000 || /[\u0000-\u001f\u007f]/.test(value.comment))) throw new ValidationError("Invalid ML review comment")
  if (!Number.isSafeInteger(value.expectedRecordVersion) || Number(value.expectedRecordVersion) < 1) throw new ValidationError("Invalid ML review record version")
  return { runId, candidateDigest: value.candidateDigest, evidenceDigest: value.evidenceDigest, decision, comment: value.comment as string | null, reviewerUserId: "assigned-by-server", expectedRecordVersion: Number(value.expectedRecordVersion) }
}
