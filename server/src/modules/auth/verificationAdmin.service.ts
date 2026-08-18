import type { Db, ObjectId } from "mongodb"
import { usersCollection } from "../../models/user.js"
import { verificationCampaignsCollection, type VerificationAccountScope, type VerificationProviderScope } from "../../models/verificationCampaign.js"

export const startVerificationCampaign = async (db: Db, input: { createdBy: ObjectId; providerScope: VerificationProviderScope; accountScope: VerificationAccountScope }) => {
  const provider = input.providerScope === "both" ? ["password", "google"] : [input.providerScope]
  const accountType = input.accountScope === "both" ? { $in: ["individual", "enterprise"] } : input.accountScope
  const now = new Date()
  const result = await usersCollection(db).updateMany(
    { platformRole: { $ne: "super_admin" }, accountType, authProviders: { $in: provider } },
    { $set: { verificationRequiredAt: now, verificationReason: "admin", updatedAt: now }, $unset: { identityVerification: "" } }
  )
  const campaign = { createdBy: input.createdBy, providerScope: input.providerScope, accountScope: input.accountScope, matchedCount: result.matchedCount, createdAt: now }
  const inserted = await verificationCampaignsCollection(db).insertOne(campaign)
  return {
    id: inserted.insertedId.toHexString(),
    providerScope: campaign.providerScope,
    accountScope: campaign.accountScope,
    matchedCount: campaign.matchedCount,
    createdAt: campaign.createdAt
  }
}

export const listVerificationCampaigns = async (db: Db) => {
  const items = await verificationCampaignsCollection(db).find({}).sort({ createdAt: -1 }).limit(100).toArray()
  return items.map((item) => ({ id: item._id!.toHexString(), providerScope: item.providerScope, accountScope: item.accountScope, matchedCount: item.matchedCount, createdAt: item.createdAt.toISOString() }))
}
