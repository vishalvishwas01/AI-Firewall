import type { OrganizationDocument, OrganizationMemberDocument, OrganizationSitePolicyDocument } from "../../models/organization.js"

export const toPublicOrganization = (org: OrganizationDocument, membership?: OrganizationMemberDocument) => ({
  id: org._id?.toHexString(),
  name: org.name,
  role: membership?.role ?? "member",
  createdAt: org.createdAt.toISOString(),
  updatedAt: org.updatedAt.toISOString()
})

export const toPublicMember = (member: OrganizationMemberDocument) => ({
  id: member._id?.toHexString(),
  userId: member.userId?.toHexString(),
  email: member.email,
  role: member.role,
  status: member.status,
  revokedAt: member.revokedAt?.toISOString(),
  createdAt: member.createdAt.toISOString(),
  updatedAt: member.updatedAt.toISOString()
})

export const toPublicSitePolicy = (site: OrganizationSitePolicyDocument) => ({
  id: site._id?.toHexString(),
  hostname: site.hostname,
  label: site.label,
  createdAt: site.createdAt.toISOString(),
  updatedAt: site.updatedAt.toISOString(),
  ...(site.policy ? { policy: site.policy } : {})
})
