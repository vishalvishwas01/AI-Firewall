import { exactObject } from "../../shared/validation.js"
import { ValidationError } from "../../shared/errors.js"

export type ManualTrainingTriggerRequest = {
  triggerId: string
  inputDigest: string
  runProfileId: "profile-logistic-v1"
}

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/
const digestPattern = /^[a-f0-9]{64}$/

export const parseManualTrainingTriggerRequest = (body: unknown): ManualTrainingTriggerRequest => {
  const value = exactObject(body, ["triggerId", "inputDigest", "runProfileId"], "Invalid ML training trigger")
  if (typeof value.triggerId !== "string" || !idPattern.test(value.triggerId)) throw new ValidationError("Invalid ML training trigger id")
  if (typeof value.inputDigest !== "string" || !digestPattern.test(value.inputDigest)) throw new ValidationError("Invalid ML input digest")
  if (value.runProfileId !== "profile-logistic-v1") throw new ValidationError("Unsupported ML run profile")
  return { triggerId: value.triggerId, inputDigest: value.inputDigest, runProfileId: value.runProfileId }
}
