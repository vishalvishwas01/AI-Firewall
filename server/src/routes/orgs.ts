import { ObjectId } from "mongodb"
import { Router } from "express"

import { getDb } from "../db/mongo.js"
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js"
import {
  organizationMembersCollection,
  organizationSitePoliciesCollection,
  organizationsCollection,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  type OrganizationRole,
  type OrganizationSitePolicyDocument
} from "../models/organization.js"
import { syncedLogsCollection } from "../models/syncedLog.js"
import { usersCollection } from "../models/user.js"
import {
  addLogToOrganizationTrend,
  createOrganizationTrendWindow,
  normalizeOrganizationTrendDays,
  type OrganizationTrendDays
} from "../utils/organizationTrends.js"

const router = Router()

const roles = ["admin", "member"] as const
const severities = ["low", "medium", "high"] as const
const eventTypes = ["sensitive-data", "prompt-injection", "risky-upload", "scam-fraud"] as const
const decisions = ["warned", "blocked", "ignored", "allowed", "redacted-copied"] as const
const warningFeedback = ["correct-warning", "false-alarm", "missed-risk"] as const

const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase().slice(0, 180) : ""

const normalizeName = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, 100) : ""

const normalizeHostname = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (!raw) return ""

  try {
    const withProtocol = raw.startsWith("http://") || raw.startsWith("https://")
    const hostname = new URL(withProtocol ? raw : `https://${raw}`).hostname
    return hostname.replace(/^www\./, "").slice(0, 180)
  } catch {
    return raw
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .replace(/^www\./, "")
      .slice(0, 180)
  }
}

const normalizeSiteLabel = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, 80) : ""

const routeParam = (value: string | string[]) => (Array.isArray(value) ? value[0] ?? "" : value)

const isOneOf = <T extends readonly string[]>(value: unknown, allowed: T): value is T[number] =>
  typeof value === "string" && allowed.includes(value)

const emptyCountMap = <T extends readonly string[]>(items: T) =>
  Object.fromEntries(items.map((item) => [item, 0])) as Record<T[number], number>

const publicOrganization = (
  org: OrganizationDocument,
  membership?: OrganizationMemberDocument
) => ({
  id: org._id?.toHexString(),
  name: org.name,
  role: membership?.role ?? "member",
  createdAt: org.createdAt.toISOString(),
  updatedAt: org.updatedAt.toISOString()
})

const publicMember = (member: OrganizationMemberDocument) => ({
  id: member._id?.toHexString(),
  userId: member.userId?.toHexString(),
  email: member.email,
  role: member.role,
  status: member.status,
  revokedAt: member.revokedAt?.toISOString(),
  createdAt: member.createdAt.toISOString(),
  updatedAt: member.updatedAt.toISOString()
})

const publicSitePolicy = (site: OrganizationSitePolicyDocument) => ({
  id: site._id?.toHexString(),
  hostname: site.hostname,
  label: site.label,
  createdAt: site.createdAt.toISOString(),
  updatedAt: site.updatedAt.toISOString()
})

const requireOrganizationMembership = async (
  req: AuthenticatedRequest,
  organizationId: string,
  allowedRoles?: OrganizationRole[]
) => {
  if (!req.user || !ObjectId.isValid(organizationId)) return undefined

  const db = await getDb()
  const orgId = new ObjectId(organizationId)
  const membership = await organizationMembersCollection(db).findOne({
    organizationId: orgId,
    userId: req.user.id,
    status: "active"
  })

  if (!membership) return undefined
  if (allowedRoles && !allowedRoles.includes(membership.role)) return undefined

  const org = await organizationsCollection(db).findOne({ _id: orgId })
  if (!org) return undefined

  return { org, membership }
}

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
      { userId: { $in: userIds } },
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
        { userId: { $in: userIds }, timestamp: { $gte: from, $lt: to } },
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

    res.json({
      organizations: orgs.map((org) =>
        publicOrganization(
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

    const name = normalizeName(req.body?.name)
    if (!name) {
      res.status(400).json({ error: "Enter an organization name" })
      return
    }

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

    res.status(201).json({ organization: publicOrganization(org, membership) })
  } catch (error) {
    next(error)
  }
})

router.get("/:id/trends", async (req: AuthenticatedRequest, res, next) => {
  try {
    const access = await requireOrganizationMembership(req, routeParam(req.params.id))
    if (!access || !access.org._id) {
      res.status(404).json({ error: "Organization not found" })
      return
    }

    const trends = await buildOrganizationTrends(
      access.org._id,
      normalizeOrganizationTrendDays(req.query.days)
    )
    res.json({ trends })
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

    res.json({
      organization: publicOrganization(access.org, access.membership),
      members: members.map(publicMember),
      summary
    })
  } catch (error) {
    next(error)
  }
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

    res.json({ sites: sites.map(publicSitePolicy) })
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

    const hostname = normalizeHostname(req.body?.hostname)
    const label = normalizeSiteLabel(req.body?.label)
    if (!hostname || !label || !hostname.includes(".")) {
      res.status(400).json({ error: "Enter a domain and website name" })
      return
    }

    const db = await getDb()
    const now = new Date()
    const policies = organizationSitePoliciesCollection(db)
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
          updatedAt: now
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

    res.status(201).json({ site: publicSitePolicy(site) })
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

    const email = normalizeEmail(req.body?.email)
    const role = isOneOf(req.body?.role, roles) ? req.body.role : "member"

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Enter a valid member email" })
      return
    }

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

    res.status(201).json({ member: publicMember(member) })
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

    const nextRole = isOneOf(req.body?.role, roles) ? req.body.role : undefined
    if (!nextRole) {
      res.status(400).json({ error: "Choose a valid role" })
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

    res.json({ member: publicMember(updated) })
  } catch (error) {
    next(error)
  }
})

router.post("/:id/invitations/:memberId/revoke", async (req: AuthenticatedRequest, res, next) => {
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
      { _id: member._id, organizationId: access.org._id, status: "invited" },
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
    res.json({ member: publicMember(revoked) })
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
