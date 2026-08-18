import type { Db } from "mongodb"

import { loginActivityCollection, type LoginActivityEntry } from "../../models/loginActivity.js"
import { usersCollection, type UserAccountType } from "../../models/user.js"

export type AdminLoginActivityFilters = {
  email?: string
  accountType?: UserAccountType
  authMethod?: LoginActivityEntry["authMethod"]
  outcome?: "success" | "failed"
  days?: 1 | 7 | 30 | 90
  ipAddress?: string
}

const activityDto = (activity: LoginActivityEntry) => ({
  id: activity.eventId,
  authMethod: activity.authMethod,
  ipAddress: activity.ipAddress,
  ...(activity.location ? { location: activity.location } : {}),
  userAgent: activity.userAgent,
  device: activity.device,
  success: activity.success,
  ...(activity.failureReason ? { failureReason: activity.failureReason } : {}),
  createdAt: activity.createdAt.toISOString()
})

export const adminLoginActivity = async (db: Db, filters: AdminLoginActivityFilters) => {
  const escapedEmail = filters.email?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const users = await usersCollection(db).find({
    ...(escapedEmail ? { email: { $regex: escapedEmail, $options: "i" } } : {}),
    ...(filters.accountType ? { accountType: filters.accountType } : {})
  }, { projection: { email: 1, name: 1, accountType: 1 } }).toArray()
  const userById = new Map(users.filter((user) => user._id).map((user) => [user._id!.toHexString(), user]))
  const documents = userById.size === 0 ? [] : await loginActivityCollection(db).find({ userId: { $in: users.map((user) => user._id!) } }).toArray()
  const cutoff = filters.days ? Date.now() - filters.days * 24 * 60 * 60 * 1000 : undefined
  const groups = documents.flatMap((document) => {
    if (!document.userId || !document._id) return []
    const user = userById.get(document.userId.toHexString())
    if (!user) return []
    const activities = document.activities.filter((activity) => {
      if (filters.authMethod && activity.authMethod !== filters.authMethod) return false
      if (filters.outcome === "success" && !activity.success) return false
      if (filters.outcome === "failed" && activity.success) return false
      if (cutoff && activity.createdAt.getTime() < cutoff) return false
      if (filters.ipAddress && !activity.ipAddress.toLowerCase().includes(filters.ipAddress.toLowerCase())) return false
      return true
    })
    if (activities.length === 0) return []
    return [{
      documentId: document._id.toHexString(),
      userId: document.userId.toHexString(),
      name: user.name || user.email.split("@")[0],
      email: user.email,
      accountType: user.accountType ?? "individual",
      totalActivities: activities.length,
      lastActivityAt: activities[0].createdAt.toISOString(),
      activities: activities.map(activityDto)
    }]
  }).sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt))
  const anonymousDocuments = await loginActivityCollection(db).find({ userId: { $exists: false } }, { projection: { activities: 1 } }).toArray()
  const anonymousAttempts = anonymousDocuments.reduce((total, document) => total + document.activities.filter((activity) => {
    if (filters.authMethod && activity.authMethod !== filters.authMethod) return false
    if (filters.outcome === "success" && !activity.success) return false
    if (filters.outcome === "failed" && activity.success) return false
    if (cutoff && activity.createdAt.getTime() < cutoff) return false
    if (filters.ipAddress && !activity.ipAddress.toLowerCase().includes(filters.ipAddress.toLowerCase())) return false
    return true
  }).length, 0)
  return { users: groups, anonymousAttempts }
}
