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

export const organizationsCollection = (db: Db): Collection<OrganizationDocument> =>
  db.collection<OrganizationDocument>("organizations")

export const organizationMembersCollection = (
  db: Db
): Collection<OrganizationMemberDocument> =>
  db.collection<OrganizationMemberDocument>("organization_members")

export const ensureOrganizationIndexes = async (db: Db) => {
  await organizationsCollection(db).createIndex({ ownerUserId: 1, createdAt: -1 })
  await organizationMembersCollection(db).createIndex({ userId: 1, organizationId: 1 })
  await organizationMembersCollection(db).createIndex(
    { organizationId: 1, email: 1 },
    { unique: true }
  )
}
