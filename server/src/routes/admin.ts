import { Router } from "express"

import { detectionBenchmarkSnapshot } from "../data/detectionBenchmarkSnapshot.js"
import { getDb } from "../db/mongo.js"
import { requireAuth, requireSuperAdmin, type AuthenticatedRequest } from "../middleware/auth.js"
import { organizationMembersCollection } from "../models/organization.js"
import { sendJson, validateNoQuery } from "../shared/validation.js"
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

const router = Router()

router.use(requireAuth)
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
