import { array, boolean, nonEmptyString, object, oneOf, optional } from "../../lib/schema"
import type { EvaluatedFeature, Feature } from "./types"

const keys = ["individual-experience", "enterprise-experience", "reports", "organization-management", "trust-dashboard"] as const
const statuses = ["enabled", "disabled", "maintenance", "scheduled"] as const
const parseFeature = (value: unknown): Feature => {
  const input = object(value, ["key", "status", "audiences", "blockAuth", "updatedAt"], ["message", "startsAt", "endsAt"])
  const audiences = object(input.audiences, ["individual", "enterprise"])
  return { key: oneOf(input.key, keys), status: oneOf(input.status, statuses), audiences: { individual: boolean(audiences.individual), enterprise: boolean(audiences.enterprise) }, blockAuth: boolean(input.blockAuth), updatedAt: nonEmptyString(input.updatedAt, 40), ...(optional(input.message, (item) => nonEmptyString(item, 500)) ? { message: nonEmptyString(input.message, 500) } : {}), ...(optional(input.startsAt, (item) => nonEmptyString(item, 40)) ? { startsAt: nonEmptyString(input.startsAt, 40) } : {}), ...(optional(input.endsAt, (item) => nonEmptyString(item, 40)) ? { endsAt: nonEmptyString(input.endsAt, 40) } : {}) }
}
export const parseAdminFeatures = (value: unknown) => { const input = object(value, ["features", "serverTime"]); return { features: array(input.features, parseFeature, 20), serverTime: nonEmptyString(input.serverTime, 40) } }
export const parseAdminFeature = (value: unknown) => { const input = object(value, ["feature"]); return { feature: parseFeature(input.feature) } }
export const parseFeatureConfig = (value: unknown) => {
  const input = object(value, ["serverTime", "features"])
  const features = array(input.features, (item) => {
    const record = object(item, ["key", "individual", "enterprise"])
    const parse = (entry: unknown): EvaluatedFeature => { const value = object(entry, ["key", "configuredStatus", "status", "enabled", "blockAuth"], ["message", "startsAt", "endsAt"]); return { key: oneOf(value.key, keys), configuredStatus: oneOf(value.configuredStatus, statuses), status: oneOf(value.status, statuses), enabled: boolean(value.enabled), blockAuth: boolean(value.blockAuth), ...(typeof value.message === "string" ? { message: value.message } : {}), ...(typeof value.startsAt === "string" ? { startsAt: value.startsAt } : {}), ...(typeof value.endsAt === "string" ? { endsAt: value.endsAt } : {}) } }
    return { key: oneOf(record.key, keys), individual: parse(record.individual), enterprise: parse(record.enterprise) }
  }, 20)
  return { serverTime: nonEmptyString(input.serverTime, 40), features }
}
