import type { Collection, Db, ObjectId } from "mongodb"

export type VerificationProviderScope = "password" | "google" | "both"
export type VerificationAccountScope = "individual" | "enterprise" | "both"
export type VerificationCampaignDocument = {
  _id?: ObjectId
  createdBy: ObjectId
  providerScope: VerificationProviderScope
  accountScope: VerificationAccountScope
  matchedCount: number
  createdAt: Date
}

export const verificationCampaignsCollection = (db: Db): Collection<VerificationCampaignDocument> => db.collection("verification_campaigns")

export const ensureVerificationCampaignIndexes = async (db: Db) => {
  await verificationCampaignsCollection(db).createIndex({ createdAt: -1 })
}
