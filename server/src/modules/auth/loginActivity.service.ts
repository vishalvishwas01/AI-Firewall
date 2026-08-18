import { randomUUID } from "node:crypto"
import { isIP } from "node:net"
import type { Db, ObjectId } from "mongodb"
import type { Request } from "express"

import { env } from "../../config/env.js"
import { anonymousLoginSubject, loginActivityCollection, type LoginActivityEntry } from "../../models/loginActivity.js"

type LoginLocation = NonNullable<LoginActivityEntry["location"]>
const maximumActivities = 100
const retentionMs = () => env.loginActivityRetentionDays * 24 * 60 * 60 * 1000

const boundedHeader = (value: string | undefined, max: number) => (value ?? "").trim().slice(0, max)
const requestIp = (req: Request) => {
  const observed = (req.ip ?? req.socket.remoteAddress ?? "unknown").split(",")[0].trim()
  return (observed.startsWith("::ffff:") ? observed.slice(7) : observed).slice(0, 64) || "unknown"
}

const deviceFromUserAgent = (userAgent: string) => ({
  browser: /Edg\//i.test(userAgent) ? "Edge" : /OPR\//i.test(userAgent) ? "Opera" : /Chrome\//i.test(userAgent) ? "Chrome" : /Firefox\//i.test(userAgent) ? "Firefox" : /Safari\//i.test(userAgent) ? "Safari" : "Unknown browser",
  os: /Windows/i.test(userAgent) ? "Windows" : /Android/i.test(userAgent) ? "Android" : /iPhone|iPad|iPod/i.test(userAgent) ? "iOS" : /CrOS/i.test(userAgent) ? "ChromeOS" : /Mac OS X|Macintosh/i.test(userAgent) ? "macOS" : /Linux/i.test(userAgent) ? "Linux" : "Unknown OS"
})

const trustedProxyLocation = (req: Request): LoginLocation | undefined => {
  if (env.trustProxyHops === 0) return undefined
  const countryCode = boundedHeader(req.header("cf-ipcountry") ?? req.header("x-vercel-ip-country"), 2).toUpperCase()
  const region = boundedHeader(req.header("x-vercel-ip-country-region"), 120)
  const city = boundedHeader(req.header("x-vercel-ip-city"), 120)
  const timezone = boundedHeader(req.header("x-vercel-ip-timezone"), 80)
  if (!countryCode && !region && !city && !timezone) return undefined
  return { ...(countryCode ? { countryCode } : {}), ...(region ? { region } : {}), ...(city ? { city } : {}), ...(timezone ? { timezone } : {}) }
}

const publicAddress = (ip: string) => {
  if (!isIP(ip) || ip === "::1" || ip === "0.0.0.0") return false
  if (ip.includes(":")) return !/^(fc|fd)[0-9a-f]{2}:|^fe[89ab][0-9a-f]:/i.test(ip)
  const [first, second] = ip.split(".").map(Number)
  return first !== 10 && first !== 127 && first !== 0 && !(first === 100 && second >= 64 && second <= 127) && !(first === 169 && second === 254) && !(first === 172 && second >= 16 && second <= 31) && !(first === 192 && second === 168)
}

const resolveLocation = async (ip: string): Promise<LoginLocation | undefined> => {
  if (!env.loginGeolocationEnabled || !publicAddress(ip)) return undefined
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1500)
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,country_code,region,city,timezone`, { signal: controller.signal })
    if (!response.ok) return undefined
    const value = await response.json() as Record<string, unknown>
    if (value.success !== true) return undefined
    const timezoneValue = value.timezone
    const timezone = typeof timezoneValue === "string" ? timezoneValue : timezoneValue && typeof timezoneValue === "object" && typeof (timezoneValue as Record<string, unknown>).id === "string" ? (timezoneValue as Record<string, unknown>).id as string : ""
    const read = (field: string, max: number) => typeof value[field] === "string" ? (value[field] as string).slice(0, max) : ""
    const country = read("country", 120); const countryCode = read("country_code", 2).toUpperCase(); const region = read("region", 120); const city = read("city", 120)
    return { ...(country ? { country } : {}), ...(countryCode ? { countryCode } : {}), ...(region ? { region } : {}), ...(city ? { city } : {}), ...(timezone ? { timezone: timezone.slice(0, 80) } : {}) }
  } catch { return undefined } finally { clearTimeout(timer) }
}

export const recordLoginActivity = async (db: Db, req: Request, input: { userId?: ObjectId; authMethod: "password" | "google"; success: boolean; failureReason?: string }) => {
  try {
    const now = new Date()
    const cutoff = new Date(now.getTime() - retentionMs())
    const ipAddress = requestIp(req)
    const userAgent = boundedHeader(req.header("user-agent"), 512)
    const location = trustedProxyLocation(req)
    const entry: LoginActivityEntry = { eventId: randomUUID(), authMethod: input.authMethod, ipAddress, ...(location ? { location } : {}), userAgent, device: deviceFromUserAgent(userAgent), success: input.success, ...(input.failureReason ? { failureReason: input.failureReason.slice(0, 80) } : {}), createdAt: now }
    const subjectKey = input.userId ? `user:${input.userId.toHexString()}` : anonymousLoginSubject(ipAddress)
    await loginActivityCollection(db).updateOne(
      { subjectKey },
      [{ $set: {
        subjectKey: { $ifNull: ["$subjectKey", subjectKey] },
        ...(input.userId ? { userId: { $ifNull: ["$userId", input.userId] } } : {}),
        activities: { $slice: [{ $concatArrays: [[entry], { $filter: { input: { $ifNull: ["$activities", []] }, as: "activity", cond: { $gte: ["$$activity.createdAt", cutoff] } } }] }, maximumActivities] },
        updatedAt: now,
        expiresAt: new Date(now.getTime() + retentionMs())
      } }],
      { upsert: true }
    )
    if (!location && env.loginGeolocationEnabled) {
      void resolveLocation(ipAddress).then(async (resolved) => {
        if (resolved) await loginActivityCollection(db).updateOne({ subjectKey, "activities.eventId": entry.eventId }, { $set: { "activities.$.location": resolved } })
      }).catch(() => undefined)
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "login_activity_write_failed", name: error instanceof Error ? error.name : "UnknownError" }))
  }
}

export const userLoginActivity = async (db: Db, userId: ObjectId) => {
  const document = await loginActivityCollection(db).findOne({ userId })
  const cutoff = Date.now() - retentionMs()
  return (document?.activities ?? []).filter((item) => item.createdAt.getTime() >= cutoff).slice(0, 50).map((item) => ({
    id: item.eventId,
    authMethod: item.authMethod,
    ipAddress: item.ipAddress,
    ...(item.location ? { location: item.location } : {}),
    device: item.device,
    success: item.success,
    ...(item.failureReason ? { failureReason: item.failureReason } : {}),
    createdAt: item.createdAt.toISOString()
  }))
}
