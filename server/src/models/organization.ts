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
  status: "active" | "invited"
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

export const activateOrganizationInvitations = async (
  db: Db,
  userId: ObjectId,
  email: string
) => {
  const now = new Date()
  return organizationMembersCollection(db).updateMany(
    {
      email,
      status: "invited"
    },
    {
      $set: {
        userId,
        status: "active",
        updatedAt: now
      }
    }
  )
}

export const ensureOrganizationIndexes = async (db: Db) => {
  await organizationsCollection(db).createIndex({ ownerUserId: 1, createdAt: -1 })
  await organizationMembersCollection(db).createIndex({ userId: 1, organizationId: 1 })
  await organizationMembersCollection(db).createIndex(
    { organizationId: 1, email: 1 },
    { unique: true }
  )
  await organizationSitePoliciesCollection(db).createIndex(
    { organizationId: 1, hostname: 1 },
    { unique: true }
  )
  await organizationSitePoliciesCollection(db).createIndex({
    organizationId: 1,
    label: 1
  })
}
