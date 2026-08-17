import type { Db } from "mongodb"

import { featureFlagsCollection, featureKeys, type FeatureAudience, type FeatureFlagDocument, type FeatureKey } from "./featureFlags.js"
import { FeatureUnavailableError } from "../../shared/errors.js"

export type EvaluatedFeature = {
  key: FeatureKey
  configuredStatus: FeatureFlagDocument["status"]
  status: "enabled" | "disabled" | "maintenance" | "scheduled"
  enabled: boolean
  blockAuth: boolean
  message?: string
  startsAt?: string
  endsAt?: string
}

export const defaultFeature = (key: FeatureKey): FeatureFlagDocument => ({
  key,
  status: "enabled",
  audiences: key === "individual-experience"
    ? { individual: true, enterprise: false }
    : key === "enterprise-experience"
      ? { individual: false, enterprise: true }
      : { individual: true, enterprise: true },
  blockAuth: false,
  updatedBy: undefined as never,
  createdAt: new Date(0),
  updatedAt: new Date(0)
})

export const evaluateFeature = (feature: FeatureFlagDocument, audience: FeatureAudience, now = new Date()): EvaluatedFeature => {
  const targeted = feature.audiences[audience]
  const beforeStart = Boolean(feature.startsAt && now < feature.startsAt)
  const afterEnd = Boolean(feature.endsAt && now >= feature.endsAt)
  let status: EvaluatedFeature["status"] = feature.status
  let enabled = true

  if (targeted && !afterEnd) {
    if (feature.status === "disabled") enabled = false
    if (feature.status === "maintenance") {
      status = beforeStart ? "scheduled" : "maintenance"
      enabled = beforeStart
    }
    if (feature.status === "scheduled") {
      status = beforeStart ? "scheduled" : "maintenance"
      enabled = beforeStart
    }
  } else {
    status = "enabled"
  }

  return {
    key: feature.key,
    configuredStatus: feature.status,
    status,
    enabled,
    blockAuth: feature.blockAuth === true,
    ...(feature.message ? { message: feature.message } : {}),
    ...(feature.startsAt ? { startsAt: feature.startsAt.toISOString() } : {}),
    ...(feature.endsAt ? { endsAt: feature.endsAt.toISOString() } : {})
  }
}

export const getFeature = async (db: Db, key: FeatureKey) =>
  (await featureFlagsCollection(db).findOne({ key })) ?? defaultFeature(key)

export const assertAuthEntryAvailable = async (db: Db, audience: FeatureAudience, platformRole?: string) => {
  if (platformRole === "super_admin") return
  const key: FeatureKey = audience === "enterprise" ? "enterprise-experience" : "individual-experience"
  const evaluated = evaluateFeature(await getFeature(db, key), audience)
  if (evaluated.blockAuth && !evaluated.enabled) throw new FeatureUnavailableError(evaluated.message)
}

export const getAllFeatures = async (db: Db) => {
  const saved = await featureFlagsCollection(db).find({ key: { $in: [...featureKeys] } }).toArray()
  const byKey = new Map(saved.map((feature) => [feature.key, feature]))
  return featureKeys.map((key) => byKey.get(key) ?? defaultFeature(key))
}
