import { createHash } from "node:crypto"
import type { Collection, Db, Document, ObjectId } from "mongodb"

import { env } from "../config/env.js"

export type LoginActivityEntry = {
  eventId: string
  authMethod: "password" | "google"
  ipAddress: string
  location?: { country?: string; countryCode?: string; region?: string; city?: string; timezone?: string }
  userAgent: string
  device: { browser: string; os: string }
  success: boolean
  failureReason?: string
  createdAt: Date
}

export type LoginActivityDocument = {
  _id?: ObjectId
  subjectKey: string
  userId?: ObjectId
  activities: LoginActivityEntry[]
  updatedAt: Date
  expiresAt: Date
}

export const loginActivityCollection = (db: Db): Collection<LoginActivityDocument> =>
  db.collection<LoginActivityDocument>("login_activity")

export const anonymousLoginSubject = (ipAddress: string) =>
  `ip:${createHash("sha256").update(ipAddress).digest("hex")}`

const migrateLegacyLoginActivity = async (db: Db) => {
  const raw = db.collection<Document>("login_activity")
  const legacy = await raw.find({ activities: { $exists: false }, event: "login" }).toArray()
  if (legacy.length === 0) return
  const groups = new Map<string, Document[]>()
  for (const item of legacy) {
    const userId = item.userId as ObjectId | undefined
    const ipAddress = typeof item.ipAddress === "string" ? item.ipAddress : "unknown"
    const subjectKey = userId ? `user:${userId.toHexString()}` : anonymousLoginSubject(ipAddress)
    groups.set(subjectKey, [...(groups.get(subjectKey) ?? []), item])
  }
  const retentionMs = env.loginActivityRetentionDays * 24 * 60 * 60 * 1000
  const cutoff = new Date(Date.now() - retentionMs)
  for (const [subjectKey, items] of groups) {
    const existing = await raw.findOne({ subjectKey, activities: { $exists: true } })
    const userId = (existing?.userId ?? items.find((item) => item.userId)?.userId) as ObjectId | undefined
    const migrated = items.map((item) => ({
      eventId: (item._id as ObjectId).toHexString(),
      authMethod: item.authMethod === "google" ? "google" : "password",
      ipAddress: typeof item.ipAddress === "string" ? item.ipAddress : "unknown",
      ...(item.location && typeof item.location === "object" ? { location: item.location } : {}),
      userAgent: typeof item.userAgent === "string" ? item.userAgent : "",
      device: item.device && typeof item.device === "object" ? item.device : { browser: "Unknown browser", os: "Unknown OS" },
      success: item.success === true,
      ...(typeof item.failureReason === "string" ? { failureReason: item.failureReason } : {}),
      createdAt: item.createdAt instanceof Date ? item.createdAt : new Date()
    }))
    const activities = [...(Array.isArray(existing?.activities) ? existing.activities : []), ...migrated]
      .filter((entry) => entry.createdAt instanceof Date && entry.createdAt >= cutoff)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .filter((entry, index, all) => all.findIndex((candidate) => candidate.eventId === entry.eventId) === index)
      .slice(0, 100)
    const updatedAt = activities[0]?.createdAt ?? new Date()
    const keeperId = (existing?._id ?? items[0]._id) as ObjectId
    await raw.updateOne(
      { _id: keeperId },
      {
        $set: { subjectKey, ...(userId ? { userId } : {}), activities, updatedAt, expiresAt: new Date(updatedAt.getTime() + retentionMs) },
        $unset: { event: "", authMethod: "", ipAddress: "", location: "", userAgent: "", device: "", success: "", failureReason: "", createdAt: "" }
      }
    )
    const redundantIds = items.map((item) => item._id as ObjectId).filter((id) => !id.equals(keeperId))
    if (redundantIds.length > 0) await raw.deleteMany({ _id: { $in: redundantIds } })
  }
}

export const ensureLoginActivityIndexes = async (db: Db) => {
  await migrateLegacyLoginActivity(db)
  const collection = loginActivityCollection(db)
  // Creating this first also creates the collection on a fresh installation,
  // so listing and migrating the remaining indexes is always safe.
  await collection.createIndex({ subjectKey: 1 }, { unique: true })
  const retentionName = "login_activity_retention"
  const indexes = await collection.listIndexes().toArray()
  const oldRetention = indexes.find((index) => index.name === retentionName)
  if (oldRetention && oldRetention.key?.expiresAt !== 1) await collection.dropIndex(retentionName)
  for (const oldName of ["userId_1_createdAt_-1", "ipAddress_1_createdAt_-1"]) {
    if (indexes.some((index) => index.name === oldName)) await collection.dropIndex(oldName)
  }
  await collection.createIndex({ userId: 1 }, { unique: true, sparse: true })
  await collection.createIndex({ "activities.ipAddress": 1, "activities.createdAt": -1 })
  const currentRetention = (await collection.listIndexes().toArray()).find((index) => index.name === retentionName)
  if (!currentRetention) {
    await collection.createIndex({ expiresAt: 1 }, { name: retentionName, expireAfterSeconds: 0 })
  } else if (currentRetention.expireAfterSeconds !== 0) {
    await db.command({ collMod: collection.collectionName, index: { name: retentionName, expireAfterSeconds: 0 } })
  }
}
