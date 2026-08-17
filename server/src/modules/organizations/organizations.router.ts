import { ObjectId } from "mongodb"
import { Router } from "express"

import { getDb } from "../../db/mongo.js"
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js"
import { sendJson, validateNoBody } from "../../shared/validation.js"
import { organizationMembersCollection, organizationSitePoliciesCollection, organizationsCollection, syncedLogsCollection, usersCollection } from "./organizations.repository.js"
import { extensionHealthCollection } from "../../models/organization.js"
import { healthState } from "../extensionHealth/health.schemas.js"
import {
  addLogToOrganizationTrend,
  createOrganizationTrendWindow,
  type OrganizationTrendDays
} from "../../utils/organizationTrends.js"
import { requireOrganizationMembership } from "./organizations.policy.js"
import { parseMemberInput, parseOrganizationInput, parseOrganizationSiteInput, parseRoleInput, parseTrendQuery, routeParam } from "./organizations.schemas.js"
import { toPublicMember, toPublicOrganization, toPublicSitePolicy } from "./organizations.service.js"
import { assertAllowedQuery } from "../../shared/validation.js"
import { pendingInvitationRevocationFilter } from "../../models/organization.js"
import { requireAccountExperience, requireFeature } from "../featureFlags/featureFlags.middleware.js"

const router = Router()

const severities = ["low", "medium", "high"] as const
const eventTypes = ["sensitive-data", "prompt-injection", "risky-upload", "scam-fraud"] as const
const decisions = ["warned", "blocked", "ignored", "allowed", "redacted-copied"] as const
const warningFeedback = ["correct-warning", "false-alarm", "missed-risk"] as const

const emptyCountMap = <T extends readonly string[]>(items: T) =>
  Object.fromEntries(items.map((item) => [item, 0])) as Record<T[number], number>

const buildOrganizationSummary = async (organizationId: ObjectId) => {
  const db = await getDb()
  const allMembers = await organizationMembersCollection(db).find({ organizationId }).toArray()
  const members = await organizationMembersCollection(db)
    .find({ organizationId, status: "active", userId: { $exists: true } })
    .toArray()
  const userIds = members.flatMap((member) => (member.userId ? [member.userId] : []))

  const byFeedback = emptyCountMap(warningFeedback)
  const bySeverity = emptyCountMap(severities)
  const byEventType = emptyCountMap(eventTypes)
  const byDecision = emptyCountMap(decisions)
  const byHostname: Record<string, number> = {}

  if (userIds.length === 0) {
    return {
      totalLogs: 0,
      activeMembers: allMembers.filter((member) => member.status === "active").length,
      invitedMembers: allMembers.filter((member) => member.status === "invited").length,
      revokedInvitations: allMembers.filter((member) => member.status === "revoked").length,
      feedbackTotal: 0,
      falseAlarmRate: 0,
      missedRiskRate: 0,
      byFeedback,
      bySeverity,
      byEventType,
      byDecision,
      byHostname
    }
  }

  const logs = await syncedLogsCollection(db)
    .find(
      { userId: { $in: userIds }, is_Deleted: { $ne: true } },
      {
        projection: {
          feedback: 1,
          severity: 1,
          eventType: 1,
          decision: 1,
          hostname: 1
        }
      }
    )
    .toArray()

  for (const log of logs) {
    bySeverity[log.severity] += 1
    byEventType[log.eventType] += 1
    byDecision[log.decision] += 1
    byHostname[log.hostname] = (byHostname[log.hostname] ?? 0) + 1

    if (log.feedback) {
      byFeedback[log.feedback] += 1
    }
  }

  const feedbackTotal = Object.values(byFeedback).reduce((sum, count) => sum + count, 0)

  return {
    totalLogs: logs.length,
    activeMembers: allMembers.filter((member) => member.status === "active").length,
    invitedMembers: allMembers.filter((member) => member.status === "invited").length,
    revokedInvitations: allMembers.filter((member) => member.status === "revoked").length,
    feedbackTotal,
    falseAlarmRate:
      feedbackTotal === 0 ? 0 : Number((byFeedback["false-alarm"] / feedbackTotal).toFixed(4)),
    missedRiskRate:
      feedbackTotal === 0 ? 0 : Number((byFeedback["missed-risk"] / feedbackTotal).toFixed(4)),
    byFeedback,
    bySeverity,
    byEventType,
    byDecision,
    byHostname
  }
}

const buildOrganizationTrends = async (organizationId: ObjectId, days: OrganizationTrendDays) => {
  const db = await getDb()
  const members = await organizationMembersCollection(db)
    .find({ organizationId, status: "active", userId: { $exists: true } })
    .toArray()
  const userIds = members.flatMap((member) => (member.userId ? [member.userId] : []))
  const { from, to, points } = createOrganizationTrendWindow(days)

  if (userIds.length > 0) {
    const logs = await syncedLogsCollection(db)
      .find(
        { userId: { $in: userIds }, is_Deleted: { $ne: true }, timestamp: { $gte: from, $lt: to } },
        { projection: { timestamp: 1, severity: 1, eventType: 1, feedback: 1 } }
      )
      .toArray()

    for (const log of logs) {
      addLogToOrganizationTrend(points, log)
    }
  }

  return {
    rangeDays: days,
    bucket: "day" as const,
    from: from.toISOString(),
    to: to.toISOString(),
    points: [...points.values()]
  }
}

router.use(requireAuth)
router.use(requireAccountExperience)
router.use(requireFeature("organization-management"))
router.use((req, _res, next) => {
  try {
    assertAllowedQuery(req.query as Record<string, unknown>, req.method === "GET" && req.path.endsWith("/trends") ? ["days"] : [])
    next()
  } catch (error) {
    next(error)
  }
})

router.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    const db = await getDb()
    const memberships = await organizationMembersCollection(db)
      .find({ userId: req.user.id, status: "active" })
      .toArray()
    const orgIds = memberships.map((membership) => membership.organizationId)
    const orgs = orgIds.length
      ? await organizationsCollection(db)
          .find({ _id: { $in: orgIds } })
          .sort({ createdAt: -1 })
          .toArray()
      : []

    sendJson(res, ["organizations"], {
      organizations: orgs.map((org) =>
        toPublicOrganization(
          org,
          memberships.find((membership) => org._id && membership.organizationId.equals(org._id))
        )
      )
    })
  } catch (error) {
    next(error)
  }
})

router.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    const input = parseOrganizationInput(req.body)
    if ("error" in input) {
      res.status(400).json({ error: input.error })
      return
    }
    const { name } = input

    const now = new Date()
    const db = await getDb()
    const orgInsert = await organizationsCollection(db).insertOne({
      name,
      ownerUserId: req.user.id,
      createdAt: now,
      updatedAt: now
    })

    const memberInsert = await organizationMembersCollection(db).insertOne({
      organizationId: orgInsert.insertedId,
      userId: req.user.id,
      email: req.user.email,
      role: "owner",
      status: "active",
      createdAt: now,
      updatedAt: now
    })

    const org = await organizationsCollection(db).findOne({ _id: orgInsert.insertedId })
    const membership = await organizationMembersCollection(db).findOne({
      _id: memberInsert.insertedId
    })

    if (!org || !membership) {
      throw new Error("Organization could not be loaded")
    }

    sendJson(res.status(201), ["organization"], { organization: toPublicOrganization(org, membership) })
  } catch (error) {
    next(error)
  }
})

router.get("/:id/trends", async (req: AuthenticatedRequest, res, next) => {
  try {
    assertAllowedQuery(req.query as Record<string, unknown>, ["days"])
    const access = await requireOrganizationMembership(req, routeParam(req.params.id))
    if (!access || !access.org._id) {
      res.status(404).json({ error: "Organization not found" })
      return
    }

    const trends = await buildOrganizationTrends(
      access.org._id,
      parseTrendQuery(req.query)
    )
    sendJson(res, ["trends"], { trends })
  } catch (error) {
    next(error)
  }
})

router.get("/:id", async (req: AuthenticatedRequest, res, next) => {
  try {
    const access = await requireOrganizationMembership(req, routeParam(req.params.id))
    if (!access || !access.org._id) {
      res.status(404).json({ error: "Organization not found" })
      return
    }

    const db = await getDb()
    const members = await organizationMembersCollection(db)
      .find({ organizationId: access.org._id })
      .sort({ role: 1, email: 1 })
      .toArray()
    const summary = await buildOrganizationSummary(access.org._id)

    sendJson(res, ["organization", "members", "summary"], {
      organization: toPublicOrganization(access.org, access.membership),
      members: members.map(toPublicMember),
      summary
    })
  } catch (error) {
    next(error)
  }
})

router.get("/:id/extension-health", async (req: AuthenticatedRequest, res, next) => {
  try {
    const access = await requireOrganizationMembership(req, routeParam(req.params.id))
    if (!access?.org._id) { res.status(404).json({ error: "Organization not found" }); return }
    const members = await organizationMembersCollection(await getDb()).find({ organizationId: access.org._id, status: "active", userId: { $exists: true } }).toArray()
    const userIds = members.flatMap((member) => member.userId ? [member.userId] : [])
    const records = userIds.length ? await extensionHealthCollection(await getDb()).find({ userId: { $in: userIds } }).toArray() : []
    const byUser = new Map(records.map((record) => [record.userId.toHexString(), record]))
    sendJson(res, ["health"], { health: members.map((member) => {
      const record = member.userId ? byUser.get(member.userId.toHexString()) : undefined
      return { memberId: member._id?.toHexString(), email: member.email, state: healthState(record?.lastSeen, record?.status), ...(record ? { extensionVersion: record.extensionVersion, policyVersion: record.policyVersion, intelligenceVersion: record.intelligenceVersion, lastSeen: record.lastSeen.toISOString() } : {}) }
    }) })
  } catch (error) { next(error) }
})

router.get("/:id/sites", async (req: AuthenticatedRequest, res, next) => {
  try {
    const access = await requireOrganizationMembership(req, routeParam(req.params.id))
    if (!access || !access.org._id) {
      res.status(404).json({ error: "Organization not found" })
      return
    }

    const db = await getDb()
    const sites = await organizationSitePoliciesCollection(db)
      .find({ organizationId: access.org._id })
      .sort({ label: 1, hostname: 1 })
      .toArray()

    sendJson(res, ["sites"], { sites: sites.map(toPublicSitePolicy) })
  } catch (error) {
    next(error)
  }
})

router.post("/:id/sites", async (req: AuthenticatedRequest, res, next) => {
  try {
    const access = await requireOrganizationMembership(req, routeParam(req.params.id), ["owner", "admin"])
    if (!access || !access.org._id) {
      res.status(404).json({ error: "Organization not found" })
      return
    }

    const input = parseOrganizationSiteInput(req.body)
    if ("error" in input) {
      res.status(400).json({ error: input.error })
      return
    }
    const { hostname, label, policy } = input
    const policyProvided = typeof req.body === "object" && req.body !== null && "policy" in req.body

    const db = await getDb()
    const now = new Date()
    const policies = organizationSitePoliciesCollection(db)
    const existingPolicy = await policies.findOne({ organizationId: access.org._id, hostname })
    const effectivePolicy = !policyProvided && existingPolicy?.policy ? existingPolicy.policy : policy
    if (policyProvided && existingPolicy?.policy && effectivePolicy.version <= existingPolicy.policy.version) {
      res.status(409).json({ error: "Organization policy version conflict" })
      return
    }
    await policies.updateOne(
      { organizationId: access.org._id, hostname },
      {
        $setOnInsert: {
          organizationId: access.org._id,
          hostname,
          createdAt: now
        },
        $set: {
          label,
          updatedAt: now,
          policy: effectivePolicy
        }
      },
      { upsert: true }
    )

    const site = await policies.findOne({
      organizationId: access.org._id,
      hostname
    })
    if (!site) {
      throw new Error("Organization site policy could not be loaded")
    }

    sendJson(res.status(201), ["site"], { site: toPublicSitePolicy(site) })
  } catch (error) {
    next(error)
  }
})

router.delete("/:id/sites/:siteId", async (req: AuthenticatedRequest, res, next) => {
  try {
    const siteId = routeParam(req.params.siteId)
    const access = await requireOrganizationMembership(req, routeParam(req.params.id), ["owner", "admin"])
    if (!access || !access.org._id || !ObjectId.isValid(siteId)) {
      res.status(404).json({ error: "Organization site policy not found" })
      return
    }

    const db = await getDb()
    const result = await organizationSitePoliciesCollection(db).deleteOne({
      _id: new ObjectId(siteId),
      organizationId: access.org._id
    })

    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Organization site policy not found" })
      return
    }

    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

router.post("/:id/members", async (req: AuthenticatedRequest, res, next) => {
  try {
    const access = await requireOrganizationMembership(req, routeParam(req.params.id), ["owner", "admin"])
    if (!access || !access.org._id) {
      res.status(404).json({ error: "Organization not found" })
      return
    }

    const input = parseMemberInput(req.body)
    if ("error" in input) {
      res.status(400).json({ error: input.error })
      return
    }
    const { email, role } = input

    const db = await getDb()
    const user = await usersCollection(db).findOne({ email })
    const now = new Date()
    await organizationMembersCollection(db).updateOne(
      { organizationId: access.org._id, email },
      {
        $setOnInsert: {
          organizationId: access.org._id,
          email,
          createdAt: now
        },
        $set: {
          ...(user?._id ? { userId: user._id } : {}),
          role,
          status: user?._id ? "active" : "invited",
          updatedAt: now
        },
        $unset: {
          revokedAt: "",
          ...(user?._id ? {} : { userId: "" })
        }
      },
      { upsert: true }
    )

    const member = await organizationMembersCollection(db).findOne({
      organizationId: access.org._id,
      email
    })

    if (!member) {
      throw new Error("Organization member could not be loaded")
    }

    sendJson(res.status(201), ["member"], { member: toPublicMember(member) })
  } catch (error) {
    next(error)
  }
})

router.patch("/:id/members/:memberId", async (req: AuthenticatedRequest, res, next) => {
  try {
    const memberId = routeParam(req.params.memberId)
    const access = await requireOrganizationMembership(req, routeParam(req.params.id), ["owner", "admin"])
    if (!access || !access.org._id || !ObjectId.isValid(memberId)) {
      res.status(404).json({ error: "Organization member not found" })
      return
    }

    const input = parseRoleInput(req.body)
    if ("error" in input) {
      res.status(400).json({ error: input.error })
      return
    }
    const nextRole = input.role

    const db = await getDb()
    const member = await organizationMembersCollection(db).findOne({
      _id: new ObjectId(memberId),
      organizationId: access.org._id
    })

    if (!member?._id) {
      res.status(404).json({ error: "Organization member not found" })
      return
    }

    if (member.role === "owner") {
      res.status(400).json({ error: "Owner role cannot be changed here" })
      return
    }

    if (access.membership.role === "admin" && member.role === "admin") {
      res.status(403).json({ error: "Admins cannot change other admins" })
      return
    }

    await organizationMembersCollection(db).updateOne(
      { _id: member._id, organizationId: access.org._id },
      {
        $set: {
          role: nextRole,
          updatedAt: new Date()
        }
      }
    )

    const updated = await organizationMembersCollection(db).findOne({
      _id: member._id,
      organizationId: access.org._id
    })

    if (!updated) {
      throw new Error("Organization member could not be loaded")
    }

    sendJson(res, ["member"], { member: toPublicMember(updated) })
  } catch (error) {
    next(error)
  }
})

router.post("/:id/invitations/:memberId/revoke", validateNoBody, async (req: AuthenticatedRequest, res, next) => {
  try {
    const memberId = routeParam(req.params.memberId)
    const access = await requireOrganizationMembership(req, routeParam(req.params.id), ["owner", "admin"])
    if (!access || !access.org._id || !ObjectId.isValid(memberId)) {
      res.status(404).json({ error: "Pending invitation not found" })
      return
    }

    const db = await getDb()
    const member = await organizationMembersCollection(db).findOne({
      _id: new ObjectId(memberId),
      organizationId: access.org._id
    })

    if (!member?._id) {
      res.status(404).json({ error: "Pending invitation not found" })
      return
    }
    if (member.status !== "invited") {
      res.status(409).json({ error: "Only pending invitations can be revoked" })
      return
    }
    if (access.membership.role === "admin" && member.role === "admin") {
      res.status(403).json({ error: "Admins cannot revoke other admin invitations" })
      return
    }

    const revokedAt = new Date()
    const result = await organizationMembersCollection(db).updateOne(
      pendingInvitationRevocationFilter(member._id, access.org._id),
      {
        $set: { status: "revoked", revokedAt, updatedAt: revokedAt },
        $unset: { userId: "" }
      }
    )
    if (result.modifiedCount !== 1) {
      res.status(409).json({ error: "Invitation is no longer pending" })
      return
    }
    const revoked = await organizationMembersCollection(db).findOne({
      _id: member._id,
      organizationId: access.org._id
    })
    if (!revoked) throw new Error("Revoked invitation could not be loaded")
    sendJson(res, ["member"], { member: toPublicMember(revoked) })
  } catch (error) {
    next(error)
  }
})

router.delete("/:id/members/:memberId", async (req: AuthenticatedRequest, res, next) => {
  try {
    const memberId = routeParam(req.params.memberId)
    const access = await requireOrganizationMembership(req, routeParam(req.params.id), ["owner", "admin"])
    if (!access || !access.org._id || !ObjectId.isValid(memberId)) {
      res.status(404).json({ error: "Organization member not found" })
      return
    }

    const db = await getDb()
    const member = await organizationMembersCollection(db).findOne({
      _id: new ObjectId(memberId),
      organizationId: access.org._id
    })

    if (!member?._id) {
      res.status(404).json({ error: "Organization member not found" })
      return
    }

    if (member.role === "owner") {
      res.status(400).json({ error: "Owner cannot be removed here" })
      return
    }

    if (member.status !== "active") {
      res.status(409).json({ error: "Only active members can be removed; revoke pending invitations instead" })
      return
    }

    if (access.membership.role === "admin" && member.role === "admin") {
      res.status(403).json({ error: "Admins cannot remove other admins" })
      return
    }

    await organizationMembersCollection(db).deleteOne({
      _id: member._id,
      organizationId: access.org._id
    })

    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

export const orgsRouter = router
