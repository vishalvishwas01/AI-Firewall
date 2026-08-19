import type { Collection, Db, ObjectId } from "mongodb"

export type OrganizationRole = "owner" | "admin" | "member"

export type OrganizationDocument = {
  _id?: ObjectId
  name: string
  ownerUserId: ObjectId
  createdAt: Date
  updatedAt: Date
}

export type OrganizationMemberDocument = {
  _id?: ObjectId
  organizationId: ObjectId
  userId?: ObjectId
  email: string
  role: OrganizationRole
  status: "active" | "invited" | "revoked"
  invitationTokenHash?: string
  invitationExpiresAt?: Date
  invitationSentAt?: Date
  acceptedAt?: Date
  revokedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type OrganizationSitePolicyDocument = {
  _id?: ObjectId
  organizationId: ObjectId
  hostname: string
  label: string
  createdAt: Date
  updatedAt: Date
  policy?: {
    schemaVersion: 1
    version: number
    category: "all" | "sensitive-data" | "prompt-injection" | "risky-upload" | "scam-fraud"
    minimumSeverity: "low" | "medium" | "high"
    action: "warn" | "redact" | "block"
    destination: "any" | "public-ai" | "approved-internal" | "unknown"
    allowOverride: boolean
    redactionAllowed: boolean
  }
}

export type ExtensionHealthDocument = {
  userId: ObjectId
  extensionVersion: string
  policyVersion?: number
  intelligenceVersion?: string
  status: "active" | "protection-unavailable"
  lastSeen: Date
  updatedAt: Date
}

export const organizationsCollection = (db: Db): Collection<OrganizationDocument> =>
  db.collection<OrganizationDocument>("organizations")

export const organizationMembersCollection = (
  db: Db
): Collection<OrganizationMemberDocument> =>
  db.collection<OrganizationMemberDocument>("organization_members")

export const organizationSitePoliciesCollection = (
  db: Db
): Collection<OrganizationSitePolicyDocument> =>
  db.collection<OrganizationSitePolicyDocument>("organization_site_policies")

export const extensionHealthCollection = (db: Db): Collection<ExtensionHealthDocument> =>
  db.collection<ExtensionHealthDocument>("extension_health")

export const pendingInvitationRevocationFilter = (memberId: ObjectId, organizationId: ObjectId) => ({
  _id: memberId,
  organizationId,
  status: "invited" as const
})

export const pendingInvitationActivationFilter = (userId: ObjectId, email: string) => ({
  email: email.trim().toLowerCase(),
  status: "invited" as const,
  $or: [{ userId: { $exists: false } }, { userId }]
})

export const ensureOrganizationIndexes = async (db: Db) => {
  await organizationsCollection(db).createIndex({ ownerUserId: 1, createdAt: -1 })
  await organizationMembersCollection(db).createIndex({ userId: 1, organizationId: 1 })
  await organizationMembersCollection(db).createIndex(
    { organizationId: 1, email: 1 },
    { unique: true }
  )
  await organizationMembersCollection(db).createIndex(
    { invitationTokenHash: 1 },
    { unique: true, sparse: true }
  )
  await organizationSitePoliciesCollection(db).createIndex(
    { organizationId: 1, hostname: 1 },
    { unique: true }
  )
  await organizationSitePoliciesCollection(db).createIndex({
    organizationId: 1,
    label: 1
  })
  await extensionHealthCollection(db).createIndex({ userId: 1 }, { unique: true })
  await extensionHealthCollection(db).createIndex({ updatedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })
}
