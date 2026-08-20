import { apiRequest } from "../../lib/http"
import { array, boolean, dictionary, isoDate, nonEmptyString, nonNegativeInteger, object, oneOf, string } from "../../lib/schema"
import type { HelpDeskDraft, HelpDeskMessage, HelpDeskThread } from "./types"

const parseMessage = (value: unknown): HelpDeskMessage => {
  const input = object(value, ["id", "sender", "message", "isRead", "createdAt"], ["subject"])
  return { id: nonEmptyString(input.id, 64), sender: oneOf(input.sender, ["user", "admin"] as const), ...(typeof input.subject === "string" ? { subject: string(input.subject, 180) } : {}), message: nonEmptyString(input.message, 4000), isRead: boolean(input.isRead), createdAt: isoDate(input.createdAt) }
}
const parseThread = (value: unknown): HelpDeskThread => {
  const input = object(value, ["userId", "name", "email", "unreadCount", "lastMessageAt", "messages"])
  return { userId: nonEmptyString(input.userId, 64), name: nonEmptyString(input.name, 160), email: nonEmptyString(input.email, 320), unreadCount: nonNegativeInteger(input.unreadCount), lastMessageAt: isoDate(input.lastMessageAt), messages: array(input.messages, parseMessage, 2000) }
}
export const getHelpDeskThreads = () => apiRequest<{ threads: HelpDeskThread[] }>("/admin/help-desk", {}, (value) => { const input = object(value, ["threads"]); return { threads: array(input.threads, parseThread, 2000) } })
export const markHelpDeskRead = (userId: string) => apiRequest<{ updated: number }>(`/admin/help-desk/${encodeURIComponent(userId)}/read`, { method: "PATCH" }, (value) => { const input = object(value, ["updated"]); return { updated: nonNegativeInteger(input.updated) } })
export const getHelpDeskDraft = (userId: string) => apiRequest<{ draft: HelpDeskDraft }>(`/admin/help-desk/${encodeURIComponent(userId)}/draft`, {}, (value) => { const input = object(value, ["draft"]); const draft = object(input.draft, ["subject", "message"]); return { draft: { subject: string(draft.subject, 180), message: string(draft.message, 4000) } } })
export const saveHelpDeskDraft = (userId: string, draft: HelpDeskDraft) => apiRequest<{ saved: boolean }>(`/admin/help-desk/${encodeURIComponent(userId)}/draft`, { method: "PUT", body: JSON.stringify(draft) }, (value) => { const input = object(value, ["saved"]); return { saved: boolean(input.saved) } })
export const sendHelpDeskReply = (userId: string, draft: HelpDeskDraft) => apiRequest<{ sent: boolean }>(`/admin/help-desk/${encodeURIComponent(userId)}/reply`, { method: "POST", body: JSON.stringify(draft) }, (value) => { const input = object(value, ["sent"]); return { sent: boolean(input.sent) } })

export type VerificationCampaign = { id: string; providerScope: "password" | "google" | "both"; accountScope: "individual" | "enterprise" | "both"; matchedCount: number; createdAt: string }
export const getVerificationCampaigns = () => apiRequest<{ campaigns: VerificationCampaign[] }>("/admin/verification-campaigns", {}, (value) => { const input = object(value, ["campaigns"]); return { campaigns: array(input.campaigns, (item) => { const campaign = object(item, ["id", "providerScope", "accountScope", "matchedCount", "createdAt"]); return { id: nonEmptyString(campaign.id, 64), providerScope: oneOf(campaign.providerScope, ["password", "google", "both"] as const), accountScope: oneOf(campaign.accountScope, ["individual", "enterprise", "both"] as const), matchedCount: nonNegativeInteger(campaign.matchedCount), createdAt: isoDate(campaign.createdAt) } }, 100) } })
export const startVerificationCampaign = (providerScope: VerificationCampaign["providerScope"], accountScope: VerificationCampaign["accountScope"]) => apiRequest<{ campaign: VerificationCampaign }>("/admin/verification-campaigns", { method: "POST", body: JSON.stringify({ providerScope, accountScope }) }, (value) => { const input = object(value, ["campaign"]); const campaign = object(input.campaign, ["id", "providerScope", "accountScope", "matchedCount", "createdAt"]); return { campaign: { id: nonEmptyString(campaign.id, 64), providerScope: oneOf(campaign.providerScope, ["password", "google", "both"] as const), accountScope: oneOf(campaign.accountScope, ["individual", "enterprise", "both"] as const), matchedCount: nonNegativeInteger(campaign.matchedCount), createdAt: isoDate(campaign.createdAt) } } })

export type AdminLoginActivityEvent = { id: string; authMethod: "password" | "google"; ipAddress: string; location?: { country?: string; countryCode?: string; region?: string; city?: string; timezone?: string }; userAgent: string; device: { browser: string; os: string }; success: boolean; failureReason?: string; createdAt: string }
export type AdminLoginActivityUser = { documentId: string; userId: string; name: string; email: string; accountType: "individual" | "enterprise"; totalActivities: number; lastActivityAt: string; activities: AdminLoginActivityEvent[] }
export type AdminLoginActivityFilters = { email: string; ipAddress: string; accountType: "" | "individual" | "enterprise"; authMethod: "" | "password" | "google"; outcome: "" | "success" | "failed"; days: "" | "1" | "7" | "30" | "90" }

const parseAdminActivity = (value: unknown): AdminLoginActivityEvent => {
  const input = object(value, ["id", "authMethod", "ipAddress", "userAgent", "device", "success", "createdAt"], ["location", "failureReason"])
  const device = object(input.device, ["browser", "os"])
  let location: AdminLoginActivityEvent["location"]
  if (input.location !== undefined) {
    const source = object(input.location, [], ["country", "countryCode", "region", "city", "timezone"])
    const read = (key: string, max: number) => source[key] === undefined ? undefined : nonEmptyString(source[key], max)
    location = { ...(read("country", 120) ? { country: read("country", 120) } : {}), ...(read("countryCode", 2) ? { countryCode: read("countryCode", 2) } : {}), ...(read("region", 120) ? { region: read("region", 120) } : {}), ...(read("city", 120) ? { city: read("city", 120) } : {}), ...(read("timezone", 80) ? { timezone: read("timezone", 80) } : {}) }
  }
  return { id: nonEmptyString(input.id, 64), authMethod: oneOf(input.authMethod, ["password", "google"] as const), ipAddress: nonEmptyString(input.ipAddress, 64), ...(location ? { location } : {}), userAgent: string(input.userAgent, 512), device: { browser: nonEmptyString(device.browser, 80), os: nonEmptyString(device.os, 80) }, success: boolean(input.success), ...(input.failureReason === undefined ? {} : { failureReason: nonEmptyString(input.failureReason, 80) }), createdAt: isoDate(input.createdAt) }
}

export const getAdminLoginActivity = (filters: AdminLoginActivityFilters) => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value.trim()) query.set(key, value.trim())
  const encodedQuery = query.toString()
  const suffix = encodedQuery ? `?${encodedQuery}` : ""
  return apiRequest<{ users: AdminLoginActivityUser[]; anonymousAttempts: number }>(`/admin/login-activity${suffix}`, {}, (value) => {
    const input = object(value, ["users", "anonymousAttempts"])
    return { users: array(input.users, (item) => { const user = object(item, ["documentId", "userId", "name", "email", "accountType", "totalActivities", "lastActivityAt", "activities"]); return { documentId: nonEmptyString(user.documentId, 64), userId: nonEmptyString(user.userId, 64), name: nonEmptyString(user.name, 160), email: nonEmptyString(user.email, 320), accountType: oneOf(user.accountType, ["individual", "enterprise"] as const), totalActivities: nonNegativeInteger(user.totalActivities), lastActivityAt: isoDate(user.lastActivityAt), activities: array(user.activities, parseAdminActivity, 100) } }, 10000), anonymousAttempts: nonNegativeInteger(input.anonymousAttempts) }
  })
}

export type ServerLog = { id: string; level: "error" | "warn" | "security" | "info"; category: "http" | "auth" | "email" | "system" | "security" | "database"; message: string; requestId?: string; method?: string; path?: string; statusCode?: number; ipAddress?: string; metadata?: Record<string, unknown>; createdAt: string }
export type ServerLogFilters = { from: string; to: string; level: "" | "error" | "warn" | "security" | "info"; category: "" | "http" | "auth" | "email" | "system" | "security" | "database"; search: string }
export const getServerLogs = (filters: ServerLogFilters) => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value.trim()) query.set(key, value.trim())
  const encodedQuery = query.toString()
  return apiRequest<{ logs: ServerLog[] }>(`/admin/server-logs${encodedQuery ? `?${encodedQuery}` : ""}`, {}, (value) => {
    const input = object(value, ["logs"])
    return { logs: array(input.logs, (item) => { const log = object(item, ["id", "level", "category", "message", "createdAt"], ["requestId", "method", "path", "statusCode", "ipAddress", "metadata"]); return { id: nonEmptyString(log.id, 64), level: oneOf(log.level, ["error", "warn", "security", "info"] as const), category: oneOf(log.category, ["http", "auth", "email", "system", "security", "database"] as const), message: nonEmptyString(log.message, 500), ...(log.requestId === undefined ? {} : { requestId: nonEmptyString(log.requestId, 100) }), ...(log.method === undefined ? {} : { method: nonEmptyString(log.method, 12) }), ...(log.path === undefined ? {} : { path: nonEmptyString(log.path, 300) }), ...(log.statusCode === undefined ? {} : { statusCode: nonNegativeInteger(log.statusCode) }), ...(log.ipAddress === undefined ? {} : { ipAddress: nonEmptyString(log.ipAddress, 64) }), ...(log.metadata === undefined ? {} : { metadata: dictionary(log.metadata) }), createdAt: isoDate(log.createdAt) } }, 5000) }
  })
}

export type ApiMonitoring = { total: number; byApi: Array<{ method: string; route: string; count: number }>; timeline: Array<{ bucketStart: string; count: number }> }
export const getApiMonitoring = (filters: { from: string; to: string }) => {
  const query = new URLSearchParams()
  if (filters.from.trim()) query.set("from", filters.from.trim())
  if (filters.to.trim()) query.set("to", filters.to.trim())
  return apiRequest<ApiMonitoring>(`/admin/api-monitoring${query.toString() ? `?${query}` : ""}`, {}, (value) => {
    const input = object(value, ["total", "byApi", "timeline"])
    return { total: nonNegativeInteger(input.total), byApi: array(input.byApi, (item) => { const row = object(item, ["method", "route", "count"]); return { method: nonEmptyString(row.method, 12), route: nonEmptyString(row.route, 240), count: nonNegativeInteger(row.count) } }, 500), timeline: array(input.timeline, (item) => { const row = object(item, ["bucketStart", "count"]); return { bucketStart: isoDate(row.bucketStart), count: nonNegativeInteger(row.count) } }, 1000) }
  })
}
