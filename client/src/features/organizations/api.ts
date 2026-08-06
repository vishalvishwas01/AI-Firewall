import { apiRequest } from "../../lib/http"
import type { Organization, OrganizationMember, OrganizationRole, OrganizationSitePolicy, OrganizationSummary, OrganizationTrends } from "./types"

export const getOrganizations = () => apiRequest<{ organizations: Organization[] }>("/orgs")
export const createOrganization = (name: string) => apiRequest<{ organization: Organization }>("/orgs", { method: "POST", body: JSON.stringify({ name }) })
export const getOrganization = (id: string) => apiRequest<{ organization: Organization; members: OrganizationMember[]; summary: OrganizationSummary }>(`/orgs/${id}`)
export const getOrganizationTrends = (id: string, days: 7 | 30 | 90 = 30) => apiRequest<{ trends: OrganizationTrends }>(`/orgs/${id}/trends?days=${days}`)
export const addOrganizationMember = (organizationId: string, email: string, role: Exclude<OrganizationRole, "owner"> = "member") => apiRequest<{ member: OrganizationMember }>(`/orgs/${organizationId}/members`, { method: "POST", body: JSON.stringify({ email, role }) })
export const updateOrganizationMemberRole = (organizationId: string, memberId: string, role: Exclude<OrganizationRole, "owner">) => apiRequest<{ member: OrganizationMember }>(`/orgs/${organizationId}/members/${memberId}`, { method: "PATCH", body: JSON.stringify({ role }) })
export const removeOrganizationMember = (organizationId: string, memberId: string) => apiRequest<void>(`/orgs/${organizationId}/members/${memberId}`, { method: "DELETE" })
export const revokeOrganizationInvitation = (organizationId: string, memberId: string) => apiRequest<{ member: OrganizationMember }>(`/orgs/${organizationId}/invitations/${memberId}/revoke`, { method: "POST" })
export const getOrganizationSitePolicies = (organizationId: string) => apiRequest<{ sites: OrganizationSitePolicy[] }>(`/orgs/${organizationId}/sites`)
export const createOrganizationSitePolicy = (organizationId: string, hostname: string, label: string) => apiRequest<{ site: OrganizationSitePolicy }>(`/orgs/${organizationId}/sites`, { method: "POST", body: JSON.stringify({ hostname, label }) })
export const deleteOrganizationSitePolicy = (organizationId: string, siteId: string) => apiRequest<void>(`/orgs/${organizationId}/sites/${siteId}`, { method: "DELETE" })
