import { Router } from "express"

import { detectionBenchmarkSnapshot } from "../data/detectionBenchmarkSnapshot.js"
import { getDb } from "../db/mongo.js"
import { requireAuth, requireSuperAdmin, type AuthenticatedRequest } from "../middleware/auth.js"
import { organizationMembersCollection } from "../models/organization.js"
import { exactObject, sendJson, validateNoQuery } from "../shared/validation.js"
import { featureFlagsCollection } from "../modules/featureFlags/featureFlags.js"
import { getAllFeatures } from "../modules/featureFlags/featureFlags.service.js"
import { parseFeatureKey, parseFeatureUpdate } from "../modules/featureFlags/featureFlags.schemas.js"
import { requireAccountExperience, requireFeature } from "../modules/featureFlags/featureFlags.middleware.js"
import { ObjectId } from "mongodb"
import { helpDeskCollection, type HelpDeskDocument } from "../models/helpDesk.js"
import { NotFoundError, ValidationError } from "../shared/errors.js"
import { parseHelpDeskDraft, parseHelpDeskReply } from "../modules/support/support.schemas.js"
import { getHelpDeskDraft, saveHelpDeskDraft } from "../modules/support/helpDeskDrafts.js"
import { sendHelpDeskReplyEmail } from "../shared/email.js"
import { validateNoBody } from "../shared/validation.js"
import { startVerificationCampaign, listVerificationCampaigns } from "../modules/auth/verificationAdmin.service.js"
import { adminLoginActivity, type AdminLoginActivityFilters } from "../modules/auth/loginActivityAdmin.service.js"
import { listServerLogs, type ServerLogFilters } from "../modules/admin/serverLogs.service.js"

const router = Router()

router.use(requireAuth)

router.get("/server-logs", requireSuperAdmin, validateNoBody, async (req, res, next) => {
  try {
    const allowedQuery = new Set(["from", "to", "level", "category", "search"])
    if (Object.keys(req.query).some((key) => !allowedQuery.has(key)) || Object.values(req.query).some((value) => typeof value !== "string")) throw new ValidationError("Invalid server log filters")
    const scalar = (value: unknown) => typeof value === "string" ? value.trim() : ""
    const fromValue = scalar(req.query.from); const toValue = scalar(req.query.to)
    const from = fromValue ? new Date(`${fromValue}T00:00:00.000Z`) : undefined
    const to = toValue ? new Date(`${toValue}T23:59:59.999Z`) : undefined
    if ((fromValue && Number.isNaN(from!.getTime())) || (toValue && Number.isNaN(to!.getTime())) || (from && to && from > to)) throw new ValidationError("Invalid server log date range")
    const level = scalar(req.query.level); const category = scalar(req.query.category); const search = scalar(req.query.search)
    if (level && !["error", "warn", "security", "info"].includes(level)) throw new ValidationError("Invalid server log level")
    if (category && !["http", "auth", "email", "system", "security", "database"].includes(category)) throw new ValidationError("Invalid server log category")
    if (search.length > 180) throw new ValidationError("Server log search is too long")
    const filters: ServerLogFilters = { ...(from ? { from } : {}), ...(to ? { to } : {}), ...(level ? { level: level as ServerLogFilters["level"] } : {}), ...(category ? { category: category as ServerLogFilters["category"] } : {}), ...(search ? { search } : {}) }
    sendJson(res, ["logs"], { logs: await listServerLogs(await getDb(), filters) })
  } catch (error) { next(error) }
})

router.get("/login-activity", requireSuperAdmin, validateNoBody, async (req, res, next) => {
  try {
    const allowedQuery = new Set(["email", "accountType", "authMethod", "outcome", "days", "ipAddress"])
    if (Object.keys(req.query).some((key) => !allowedQuery.has(key)) || Object.values(req.query).some((value) => typeof value !== "string")) throw new ValidationError("Invalid login activity filters")
    const scalar = (value: unknown) => typeof value === "string" ? value.trim() : ""
    const email = scalar(req.query.email)
    const accountTypeValue = scalar(req.query.accountType)
    const authMethodValue = scalar(req.query.authMethod)
    const outcomeValue = scalar(req.query.outcome)
    const daysValue = scalar(req.query.days)
    const ipAddress = scalar(req.query.ipAddress)
    if (email.length > 180 || ipAddress.length > 64) throw new ValidationError("Login activity filter is too long")
    if (accountTypeValue && accountTypeValue !== "individual" && accountTypeValue !== "enterprise") throw new ValidationError("Invalid account type filter")
    if (authMethodValue && authMethodValue !== "password" && authMethodValue !== "google") throw new ValidationError("Invalid sign-in method filter")
    if (outcomeValue && outcomeValue !== "success" && outcomeValue !== "failed") throw new ValidationError("Invalid outcome filter")
    if (daysValue && !["1", "7", "30", "90"].includes(daysValue)) throw new ValidationError("Invalid time filter")
    const filters: AdminLoginActivityFilters = {
      ...(email ? { email } : {}),
      ...(accountTypeValue ? { accountType: accountTypeValue as "individual" | "enterprise" } : {}),
      ...(authMethodValue ? { authMethod: authMethodValue as "password" | "google" } : {}),
      ...(outcomeValue ? { outcome: outcomeValue as "success" | "failed" } : {}),
      ...(daysValue ? { days: Number(daysValue) as 1 | 7 | 30 | 90 } : {}),
      ...(ipAddress ? { ipAddress } : {})
    }
    sendJson(res, ["users", "anonymousAttempts"], await adminLoginActivity(await getDb(), filters))
  } catch (error) { next(error) }
})

router.use(validateNoQuery)

router.get("/benchmark", requireAccountExperience, requireFeature("trust-dashboard"), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    const db = await getDb()
    const membership = await organizationMembersCollection(db).findOne({
      userId: req.user.id,
      status: "active",
      role: { $in: ["owner", "admin"] }
    })

    if (!membership) {
      res.status(403).json({ error: "Organization owner or admin access required" })
      return
    }

    sendJson(res, ["benchmark"], { benchmark: detectionBenchmarkSnapshot })
  } catch (error) {
    next(error)
  }
})

const toAdminFeature = (feature: Awaited<ReturnType<typeof getAllFeatures>>[number]) => ({
  key: feature.key,
  status: feature.status,
  audiences: feature.audiences,
  blockAuth: feature.blockAuth === true,
  ...(feature.message ? { message: feature.message } : {}),
  ...(feature.startsAt ? { startsAt: feature.startsAt.toISOString() } : {}),
  ...(feature.endsAt ? { endsAt: feature.endsAt.toISOString() } : {}),
  updatedAt: feature.updatedAt.toISOString()
})

router.get("/features", requireSuperAdmin, async (_req, res, next) => {
  try {
    const features = await getAllFeatures(await getDb())
    sendJson(res, ["features", "serverTime"], {
      features: features.map(toAdminFeature),
      serverTime: new Date().toISOString()
    })
  } catch (error) {
    next(error)
  }
})

router.patch("/features/:key", requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) return next(new Error("Authenticated user missing"))
    const key = parseFeatureKey(typeof req.params.key === "string" ? req.params.key : "")
    const input = parseFeatureUpdate(req.body)
    const now = new Date()
    const collection = featureFlagsCollection(await getDb())
    const existing = await collection.findOne({ key })
    const audiences = key === "individual-experience"
      ? { individual: true, enterprise: false }
      : key === "enterprise-experience"
        ? { individual: false, enterprise: true }
        : input.audiences
    const feature = {
      key,
      status: input.status,
      audiences,
      blockAuth: (key === "individual-experience" || key === "enterprise-experience") && input.blockAuth,
      updatedBy: req.user.id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(input.message ? { message: input.message } : {}),
      ...(input.startsAt ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt ? { endsAt: input.endsAt } : {})
    }
    await collection.replaceOne(
      { key },
      feature,
      { upsert: true }
    )
    sendJson(res, ["feature"], { feature: toAdminFeature(feature) })
  } catch (error) {
    next(error)
  }
})

router.get("/verification-campaigns", requireSuperAdmin, async (_req, res, next) => {
  try { sendJson(res, ["campaigns"], { campaigns: await listVerificationCampaigns(await getDb()) }) } catch (error) { next(error) }
})

router.post("/verification-campaigns", requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) throw new Error("Authenticated user missing")
    const input = exactObject(req.body, ["providerScope", "accountScope"], "Invalid verification campaign")
    const providerScope = input.providerScope === "password" || input.providerScope === "google" || input.providerScope === "both" ? input.providerScope : undefined
    const accountScope = input.accountScope === "individual" || input.accountScope === "enterprise" || input.accountScope === "both" ? input.accountScope : undefined
    if (!providerScope || !accountScope) throw new ValidationError("Choose valid provider and account filters")
    const campaign = await startVerificationCampaign(await getDb(), { createdBy: req.user.id, providerScope, accountScope })
    sendJson(res.status(201), ["campaign"], { campaign: { ...campaign, createdAt: campaign.createdAt.toISOString() } })
  } catch (error) { next(error) }
})

const helpDeskMessageDto = (item: HelpDeskDocument) => ({
  id: item._id!.toHexString(),
  sender: item.sender,
  message: item.message,
  ...(item.subject ? { subject: item.subject } : {}),
  isRead: item.isRead,
  createdAt: item.createdAt.toISOString()
})

router.get("/help-desk", requireSuperAdmin, async (_req, res, next) => {
  try {
    const newest = await helpDeskCollection(await getDb()).find({}).sort({ createdAt: -1 }).limit(2000).toArray()
    const grouped = new Map<string, { userId: string; name: string; email: string; unreadCount: number; lastMessageAt: string; messages: ReturnType<typeof helpDeskMessageDto>[] }>()
    for (const item of newest.reverse()) {
      if (!item._id) continue
      const id = item.userId.toHexString()
      const existing = grouped.get(id)
      const thread = existing ?? { userId: id, name: item.name || item.email.split("@")[0], email: item.email, unreadCount: 0, lastMessageAt: item.createdAt.toISOString(), messages: [] }
      thread.name = item.name || thread.name
      thread.email = item.email
      thread.lastMessageAt = item.createdAt.toISOString()
      if (item.sender === "user" && !item.isRead) thread.unreadCount += 1
      thread.messages.push(helpDeskMessageDto(item))
      grouped.set(id, thread)
    }
    const threads = [...grouped.values()].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
    sendJson(res, ["threads"], { threads })
  } catch (error) { next(error) }
})

router.patch("/help-desk/:userId/read", requireSuperAdmin, validateNoBody, async (req: AuthenticatedRequest, res, next) => {
  try {
    const value = typeof req.params.userId === "string" ? req.params.userId : ""
    if (!ObjectId.isValid(value)) throw new NotFoundError("Help desk conversation not found")
    const result = await helpDeskCollection(await getDb()).updateMany(
      { userId: new ObjectId(value), sender: "user", isRead: false },
      { $set: { isRead: true, updatedAt: new Date() } }
    )
    sendJson(res, ["updated"], { updated: result.modifiedCount })
  } catch (error) { next(error) }
})

router.get("/help-desk/:userId/draft", requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) throw new Error("Authenticated user missing")
    const value = typeof req.params.userId === "string" ? req.params.userId : ""
    if (!ObjectId.isValid(value)) throw new NotFoundError("Help desk conversation not found")
    sendJson(res, ["draft"], { draft: await getHelpDeskDraft(req.user.id, new ObjectId(value)) })
  } catch (error) { next(error) }
})

router.put("/help-desk/:userId/draft", requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) throw new Error("Authenticated user missing")
    const value = typeof req.params.userId === "string" ? req.params.userId : ""
    if (!ObjectId.isValid(value)) throw new NotFoundError("Help desk conversation not found")
    const input = parseHelpDeskDraft(req.body)
    if ("error" in input) throw new ValidationError(input.error)
    await saveHelpDeskDraft(req.user.id, new ObjectId(value), input)
    sendJson(res, ["saved"], { saved: true })
  } catch (error) { next(error) }
})

router.post("/help-desk/:userId/reply", requireSuperAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) throw new Error("Authenticated user missing")
    const value = typeof req.params.userId === "string" ? req.params.userId : ""
    if (!ObjectId.isValid(value)) throw new NotFoundError("Help desk conversation not found")
    const input = parseHelpDeskReply(req.body)
    if ("error" in input) throw new ValidationError(input.error)
    const userId = new ObjectId(value)
    const collection = helpDeskCollection(await getDb())
    const latest = await collection.findOne({ userId }, { sort: { createdAt: -1 } })
    if (!latest) throw new NotFoundError("Help desk conversation not found")
    await sendHelpDeskReplyEmail({ to: latest.email, name: latest.name, subject: input.subject, message: input.message })
    const now = new Date()
    await collection.insertOne({ userId, email: latest.email, ...(latest.name ? { name: latest.name } : {}), sender: "admin", adminUserId: req.user.id, subject: input.subject, message: input.message, isRead: true, createdAt: now, updatedAt: now })
    await saveHelpDeskDraft(req.user.id, userId, { subject: "", message: "" })
    sendJson(res.status(201), ["sent"], { sent: true })
  } catch (error) { next(error) }
})

export const adminRouter = router
