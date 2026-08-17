import type { Collection, Db, ObjectId } from "mongodb"

export const featureKeys = [
  "individual-experience",
  "enterprise-experience",
  "reports",
  "organization-management",
  "trust-dashboard"
] as const

export const featureStatuses = ["enabled", "disabled", "maintenance", "scheduled"] as const
export type FeatureKey = typeof featureKeys[number]
export type FeatureStatus = typeof featureStatuses[number]
export type FeatureAudience = "individual" | "enterprise"

export type FeatureFlagDocument = {
  _id?: ObjectId
  key: FeatureKey
  status: FeatureStatus
  audiences: Record<FeatureAudience, boolean>
  blockAuth?: boolean
  message?: string
  startsAt?: Date
  endsAt?: Date
  updatedBy: ObjectId
  createdAt: Date
  updatedAt: Date
}

export const featureFlagsCollection = (db: Db): Collection<FeatureFlagDocument> =>
  db.collection<FeatureFlagDocument>("featureFlags")

export const ensureFeatureFlagIndexes = async (db: Db) => {
  const features = featureFlagsCollection(db)
  await features.updateOne({ key: "individual-experience" }, { $set: { audiences: { individual: true, enterprise: false } } })
  await features.updateOne({ key: "enterprise-experience" }, { $set: { audiences: { individual: false, enterprise: true } } })
  await features.createIndex({ key: 1 }, { unique: true })
}
