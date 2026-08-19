import type { ObjectId } from "mongodb"
import { getRedisClient } from "../../db/redis.js"

export type HelpDeskDraft = { subject: string; message: string }
const keyFor = (adminId: ObjectId, userId: ObjectId) => `hallguard:admin:help-desk:draft:${adminId.toHexString()}:${userId.toHexString()}`

export const getHelpDeskDraft = async (adminId: ObjectId, userId: ObjectId): Promise<HelpDeskDraft> => {
  const key = keyFor(adminId, userId)
  const redis = await getRedisClient()
  const raw = redis ? await redis.get(key) : undefined
  if (typeof raw === "string" && raw) {
    try {
      const value = JSON.parse(raw) as Partial<HelpDeskDraft>
      return { subject: typeof value.subject === "string" ? value.subject : "", message: typeof value.message === "string" ? value.message : "" }
    } catch { return { subject: "", message: "" } }
  }
  return { subject: "", message: "" }
}

export const saveHelpDeskDraft = async (adminId: ObjectId, userId: ObjectId, draft: HelpDeskDraft) => {
  const key = keyFor(adminId, userId)
  const redis = await getRedisClient()
  if (!redis) throw new Error("Upstash Redis is not configured")
  if (!draft.subject && !draft.message) {
    await redis.del(key)
    return
  }
  await redis.set(key, JSON.stringify(draft), { ex: 30 * 24 * 60 * 60 })
}
