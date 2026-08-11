import { apiRequest } from "../../lib/http"
import type { Organization, OrganizationMember, OrganizationRole, OrganizationSitePolicy, OrganizationSummary, OrganizationTrends } from "./types"
import type { OrganizationPolicy } from "../sites/types"
import { parseMemberResponse, parseOrganizationCreatedResponse, parseOrganizationResponse, parseOrganizationSiteResponse, parseOrganizationSitesResponse, parseOrganizationsResponse, parseTrendsResponse } from "./schemas"

export const getOrganizations = () => apiRequest<{ organizations: Organization[] }>("/orgs", {}, parseOrganizationsResponse)
export const createOrganization = (name: string) => apiRequest<{ organization: Organization }>("/orgs", { method: "POST", body: JSON.stringify({ name }) }, parseOrganizationCreatedResponse)
export const getOrganization = (id: string) => apiRequest<{ organization: Organization; members: OrganizationMember[]; summary: OrganizationSummary }>(`/orgs/${id}`, {}, parseOrganizationResponse)
export const getOrganizationTrends = (id: string, days: 7 | 30 | 90 = 30) => apiRequest<{ trends: OrganizationTrends }>(`/orgs/${id}/trends?days=${days}`, {}, parseTrendsResponse)
export const addOrganizationMember = (organizationId: string, email: string, role: Exclude<OrganizationRole, "owner"> = "member") => apiRequest<{ member: OrganizationMember }>(`/orgs/${organizationId}/members`, { method: "POST", body: JSON.stringify({ email, role }) }, parseMemberResponse)
export const updateOrganizationMemberRole = (organizationId: string, memberId: string, role: Exclude<OrganizationRole, "owner">) => apiRequest<{ member: OrganizationMember }>(`/orgs/${organizationId}/members/${memberId}`, { method: "PATCH", body: JSON.stringify({ role }) }, parseMemberResponse)
export const removeOrganizationMember = (organizationId: string, memberId: string) => apiRequest<void>(`/orgs/${organizationId}/members/${memberId}`, { method: "DELETE" })
export const revokeOrganizationInvitation = (organizationId: string, memberId: string) => apiRequest<{ member: OrganizationMember }>(`/orgs/${organizationId}/invitations/${memberId}/revoke`, { method: "POST" }, parseMemberResponse)
export const getOrganizationSitePolicies = (organizationId: string) => apiRequest<{ sites: OrganizationSitePolicy[] }>(`/orgs/${organizationId}/sites`, {}, parseOrganizationSitesResponse)
export const createOrganizationSitePolicy = (organizationId: string, hostname: string, label: string, policy?: OrganizationPolicy) => apiRequest<{ site: OrganizationSitePolicy }>(`/orgs/${organizationId}/sites`, { method: "POST", body: JSON.stringify({ hostname, label, ...(policy ? { policy } : {}) }) }, parseOrganizationSiteResponse)
export const deleteOrganizationSitePolicy = (organizationId: string, siteId: string) => apiRequest<void>(`/orgs/${organizationId}/sites/${siteId}`, { method: "DELETE" })
