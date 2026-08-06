import { ObjectId } from "mongodb"

import { getDb } from "../../db/mongo.js"
import type { AuthenticatedRequest } from "../../middleware/auth.js"
import type { OrganizationRole } from "../../models/organization.js"
import { organizationMembersCollection, organizationsCollection } from "./organizations.repository.js"

export const requireOrganizationMembership = async (
  req: AuthenticatedRequest,
  organizationId: string,
  allowedRoles?: OrganizationRole[]
) => {
  if (!req.user || !ObjectId.isValid(organizationId)) return undefined
  const db = await getDb()
  const orgId = new ObjectId(organizationId)
  const membership = await organizationMembersCollection(db).findOne({
    organizationId: orgId, userId: req.user.id, status: "active"
  })
  if (!membership || (allowedRoles && !allowedRoles.includes(membership.role))) return undefined
  const org = await organizationsCollection(db).findOne({ _id: orgId })
  return org ? { org, membership } : undefined
}
