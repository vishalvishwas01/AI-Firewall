import { createHash, randomBytes } from "node:crypto"
import { ObjectId } from "mongodb"
import { Router } from "express"

import { getDb } from "../../db/mongo.js"
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js"
import { organizationMembersCollection, organizationsCollection } from "../../models/organization.js"
import { sendOrganizationInvitationEmail } from "../../shared/email.js"
import { sendJson, validateNoBody } from "../../shared/validation.js"
import { requireOrganizationMembership } from "./organizations.policy.js"
import { normalizeEmail, parseMemberInput, routeParam } from "./organizations.schemas.js"
import { toPublicMember } from "./organizations.service.js"
import { env } from "../../config/env.js"
import { requireAccountExperience, requireFeature } from "../featureFlags/featureFlags.middleware.js"

const router = Router()
const INVITATION_TTL_MS = 72 * 60 * 60 * 1000

const hashInvitationToken = (token: string) => createHash("sha256").update(token).digest("hex")
const createInvitationToken = () => randomBytes(32).toString("base64url")
const invitationUrl = (token: string) => `${env.clientOrigin.replace(/\/$/, "")}/signup?invite=${encodeURIComponent(token)}`

const createAndSendInvitation = async (input: {
  organizationId: ObjectId
  organizationName: string
  email: string
  role: "admin" | "member"
}) => {
  const db = await getDb()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS)
  const token = createInvitationToken()

  const result = await organizationMembersCollection(db).updateOne(
    { organizationId: input.organizationId, email: input.email },
    {
      $setOnInsert: { organizationId: input.organizationId, email: input.email, createdAt: now },
      $set: {
        role: input.role,
        status: "invited",
        invitationTokenHash: hashInvitationToken(token),
        invitationExpiresAt: expiresAt,
        invitationSentAt: now,
        updatedAt: now
      },
      $unset: { userId: "", revokedAt: "", acceptedAt: "" }
    },
    { upsert: true }
  )

  const member = await organizationMembersCollection(db).findOne({ organizationId: input.organizationId, email: input.email })
  if (!member || (!result.upsertedId && result.modifiedCount !== 1)) throw new Error("Organization invitation could not be created")

  try {
    await sendOrganizationInvitationEmail({
      to: input.email,
      organizationName: input.organizationName,
      role: input.role,
      invitationUrl: invitationUrl(token)
    })
  } catch (error) {
    await organizationMembersCollection(db).updateOne(
      { _id: member._id, organizationId: input.organizationId, status: "invited" },
      { $unset: { invitationTokenHash: "", invitationExpiresAt: "", invitationSentAt: "" }, $set: { updatedAt: new Date() } }
    )
    throw error
  }

  return member
}

router.get("/invitations/:token", async (req, res, next) => {
  try {
    const token = routeParam(req.params.token)
    if (!token || token.length > 256) {
      res.status(404).json({ error: "Invitation not found" })
      return
    }
    const db = await getDb()
    const member = await organizationMembersCollection(db).findOne({ invitationTokenHash: hashInvitationToken(token), status: "invited" })
    if (!member || !member.invitationExpiresAt || member.invitationExpiresAt.getTime() <= Date.now()) {
      res.status(410).json({ error: "Invitation expired or no longer available" })
      return
    }
    const organization = await organizationsCollection(db).findOne({ _id: member.organizationId })
    if (!organization) {
      res.status(404).json({ error: "Invitation not found" })
      return
    }
    sendJson(res, ["organizationName", "email", "role", "expiresAt"], {
      organizationName: organization.name,
      email: member.email,
      role: member.role,
      expiresAt: member.invitationExpiresAt.toISOString()
    })
  } catch (error) {
    next(error)
  }
})

router.use(requireAuth)
router.use(requireAccountExperience)
router.use(requireFeature("organization-management"))

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
    const email = normalizeEmail(input.email)
    if (email === req.user?.email.toLowerCase()) {
      res.status(409).json({ error: "You are already a member of this organization" })
      return
    }
    const db = await getDb()
    const existing = await organizationMembersCollection(db).findOne({ organizationId: access.org._id, email })
    if (existing?.status === "active") {
      res.status(409).json({ error: "This email is already an active member" })
      return
    }
    if (existing?.status === "invited") {
      res.status(409).json({ error: "This email already has a pending invitation. Resend it instead." })
      return
    }
    const member = await createAndSendInvitation({ organizationId: access.org._id, organizationName: access.org.name, email, role: input.role })
    sendJson(res.status(201), ["member"], { member: toPublicMember(member) })
  } catch (error) {
    next(error)
  }
})

router.post("/:id/invitations/:memberId/resend", validateNoBody, async (req: AuthenticatedRequest, res, next) => {
  try {
    const memberId = routeParam(req.params.memberId)
    const access = await requireOrganizationMembership(req, routeParam(req.params.id), ["owner", "admin"])
    if (!access || !access.org._id || !ObjectId.isValid(memberId)) {
      res.status(404).json({ error: "Pending invitation not found" })
      return
    }
    const db = await getDb()
    const member = await organizationMembersCollection(db).findOne({ _id: new ObjectId(memberId), organizationId: access.org._id, status: "invited" })
    if (!member) {
      res.status(404).json({ error: "Pending invitation not found" })
      return
    }
    if (access.membership.role === "admin" && member.role === "admin") {
      res.status(403).json({ error: "Admins cannot resend other admin invitations" })
      return
    }
    const refreshed = await createAndSendInvitation({ organizationId: access.org._id, organizationName: access.org.name, email: member.email, role: member.role === "owner" ? "member" : member.role })
    sendJson(res, ["member"], { member: toPublicMember(refreshed) })
  } catch (error) {
    next(error)
  }
})

router.post("/invitations/:token/accept", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }
    const token = routeParam(req.params.token)
    if (!token || token.length > 256) {
      res.status(404).json({ error: "Invitation not found" })
      return
    }
    const db = await getDb()
    const invitation = await organizationMembersCollection(db).findOne({ invitationTokenHash: hashInvitationToken(token), status: "invited" })
    if (!invitation || !invitation.invitationExpiresAt) {
      res.status(404).json({ error: "Invitation not found or already used" })
      return
    }
    if (invitation.invitationExpiresAt.getTime() <= Date.now()) {
      res.status(410).json({ error: "Invitation expired" })
      return
    }
    if (invitation.email !== req.user.email.trim().toLowerCase()) {
      res.status(403).json({ error: `This invitation was sent to ${invitation.email}` })
      return
    }

    const now = new Date()
    const result = await organizationMembersCollection(db).updateOne(
      { _id: invitation._id, status: "invited", invitationTokenHash: hashInvitationToken(token) },
      {
        $set: { userId: req.user.id, status: "active", acceptedAt: now, updatedAt: now },
        $unset: { invitationTokenHash: "", invitationExpiresAt: "", invitationSentAt: "", revokedAt: "" }
      }
    )
    if (result.modifiedCount !== 1) {
      res.status(409).json({ error: "Invitation was already accepted or changed" })
      return
    }
    const organization = await organizationsCollection(db).findOne({ _id: invitation.organizationId })
    sendJson(res, ["organizationName", "role"], { organizationName: organization?.name ?? "Organization", role: invitation.role })
  } catch (error) {
    next(error)
  }
})

export const invitationsRouter = router
