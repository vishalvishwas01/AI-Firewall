import { ValidationError } from "../../shared/errors.js"
import { exactObject, isRecord } from "../../shared/validation.js"
import { featureKeys, featureStatuses, type FeatureKey } from "./featureFlags.js"

export const parseFeatureKey = (value: string): FeatureKey => {
  if (!featureKeys.includes(value as FeatureKey)) throw new ValidationError("Unknown feature")
  return value as FeatureKey
}

const optionalDate = (value: unknown, field: string) => {
  if (value === null || value === undefined || value === "") return undefined
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new ValidationError(`${field} must be an ISO date`)
  return new Date(value)
}

export const parseFeatureUpdate = (value: unknown) => {
  const input = exactObject(value, ["status", "audiences"], ["blockAuth", "message", "startsAt", "endsAt"], "Invalid feature configuration")
  if (!featureStatuses.includes(input.status as typeof featureStatuses[number])) throw new ValidationError("Invalid feature status")
  if (!isRecord(input.audiences) || Object.keys(input.audiences).some((key) => !["individual", "enterprise"].includes(key)) || typeof input.audiences.individual !== "boolean" || typeof input.audiences.enterprise !== "boolean") {
    throw new ValidationError("Invalid feature audience")
  }
  if (input.blockAuth !== undefined && typeof input.blockAuth !== "boolean") throw new ValidationError("Invalid authentication block setting")
  const message = input.message === undefined || input.message === null ? undefined : typeof input.message === "string" ? input.message.trim() : null
  if (message === null || (message !== undefined && message.length > 500)) throw new ValidationError("Feature message must be at most 500 characters")
  const startsAt = optionalDate(input.startsAt, "startsAt")
  const endsAt = optionalDate(input.endsAt, "endsAt")
  if (startsAt && endsAt && endsAt <= startsAt) throw new ValidationError("endsAt must be after startsAt")
  if (input.status === "scheduled" && !startsAt) throw new ValidationError("Scheduled features require startsAt")
  return {
    status: input.status as typeof featureStatuses[number],
    audiences: { individual: input.audiences.individual, enterprise: input.audiences.enterprise },
    blockAuth: input.blockAuth === true,
    ...(message ? { message } : {}),
    ...(startsAt ? { startsAt } : {}),
    ...(endsAt ? { endsAt } : {})
  }
}
