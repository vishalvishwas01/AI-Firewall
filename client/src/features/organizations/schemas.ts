import { array, isoDate, nonEmptyString, nonNegativeInteger, object, oneOf, optional, ResponseValidationError } from "../../lib/schema"
import { parseReportSummary } from "../reports/schemas"
import type { ExtensionHealth, Organization, OrganizationMember, OrganizationSitePolicy, OrganizationSummary, OrganizationTrendPoint, OrganizationTrends } from "./types"
import { parseOrganizationPolicy } from "../sites/schemas"

const roles = ["owner", "admin", "member"] as const
const statuses = ["active", "invited", "revoked"] as const
export const parseOrganization = (value: unknown): Organization => {
  const input = object(value, ["id", "name", "role", "createdAt", "updatedAt"])
  return { id: nonEmptyString(input.id, 64), name: nonEmptyString(input.name, 120), role: oneOf(input.role, roles), createdAt: isoDate(input.createdAt), updatedAt: isoDate(input.updatedAt) }
}
export const parseOrganizationMember = (value: unknown): OrganizationMember => {
  const input = object(value, ["id", "email", "role", "status", "createdAt", "updatedAt"], ["userId", "revokedAt"])
  return { id: nonEmptyString(input.id, 64), userId: optional(input.userId, (item) => nonEmptyString(item, 64)), email: nonEmptyString(input.email, 320), role: oneOf(input.role, roles), status: oneOf(input.status, statuses), revokedAt: optional(input.revokedAt, isoDate), createdAt: isoDate(input.createdAt), updatedAt: isoDate(input.updatedAt) }
}
export const parseOrganizationSummary = (value: unknown): OrganizationSummary => {
  const input = object(value, ["totalLogs", "feedbackTotal", "falseAlarmRate", "missedRiskRate", "byFeedback", "bySeverity", "byEventType", "byDecision", "byHostname", "activeMembers", "invitedMembers", "revokedInvitations"])
  const report = parseReportSummary({ totalLogs: input.totalLogs, feedbackTotal: input.feedbackTotal, falseAlarmRate: input.falseAlarmRate, missedRiskRate: input.missedRiskRate, byFeedback: input.byFeedback, bySeverity: input.bySeverity, byEventType: input.byEventType, byDecision: input.byDecision, byHostname: input.byHostname })
  return { ...report, activeMembers: nonNegativeInteger(input.activeMembers), invitedMembers: nonNegativeInteger(input.invitedMembers), revokedInvitations: nonNegativeInteger(input.revokedInvitations) }
}
export const parseOrganizationSitePolicy = (value: unknown): OrganizationSitePolicy => {
  const input = object(value, ["id", "hostname", "label", "createdAt", "updatedAt"], ["policy"])
  return { id: nonEmptyString(input.id, 64), hostname: nonEmptyString(input.hostname, 180), label: nonEmptyString(input.label, 120), createdAt: isoDate(input.createdAt), updatedAt: isoDate(input.updatedAt), ...(input.policy === undefined ? {} : { policy: parseOrganizationPolicy(input.policy) }) }
}
const parseTrendPoint = (value: unknown): OrganizationTrendPoint => {
  const input = object(value, ["date", "totalLogs", "bySeverity", "byEventType", "byFeedback"])
  const summary = parseReportSummary({ totalLogs: input.totalLogs, feedbackTotal: 0, falseAlarmRate: 0, missedRiskRate: 0, byFeedback: input.byFeedback, bySeverity: input.bySeverity, byEventType: input.byEventType, byDecision: { warned: 0, blocked: 0, ignored: 0, allowed: 0, "redacted-copied": 0 }, byHostname: {} })
  return { date: isoDate(input.date), totalLogs: summary.totalLogs, bySeverity: summary.bySeverity, byEventType: summary.byEventType, byFeedback: summary.byFeedback }
}
export const parseOrganizationTrends = (value: unknown): OrganizationTrends => {
  const input = object(value, ["rangeDays", "bucket", "from", "to", "points"])
  const rangeDays = input.rangeDays
  if (rangeDays !== 7 && rangeDays !== 30 && rangeDays !== 90) throw new ResponseValidationError()
  return { rangeDays, bucket: oneOf(input.bucket, ["day"] as const), from: isoDate(input.from), to: isoDate(input.to), points: array(input.points, parseTrendPoint, 90) }
}
export const parseOrganizationsResponse = (value: unknown) => { const input = object(value, ["organizations"]); return { organizations: array(input.organizations, parseOrganization, 1000) } }
export const parseOrganizationCreatedResponse = (value: unknown) => { const input = object(value, ["organization"]); return { organization: parseOrganization(input.organization) } }
export const parseOrganizationResponse = (value: unknown) => { const input = object(value, ["organization", "members", "summary"]); return { organization: parseOrganization(input.organization), members: array(input.members, parseOrganizationMember, 5000), summary: parseOrganizationSummary(input.summary) } }
export const parseTrendsResponse = (value: unknown) => { const input = object(value, ["trends"]); return { trends: parseOrganizationTrends(input.trends) } }
export const parseMemberResponse = (value: unknown) => { const input = object(value, ["member"]); return { member: parseOrganizationMember(input.member) } }
export const parseOrganizationSitesResponse = (value: unknown) => { const input = object(value, ["sites"]); return { sites: array(input.sites, parseOrganizationSitePolicy, 2000) } }
export const parseOrganizationSiteResponse = (value: unknown) => { const input = object(value, ["site"]); return { site: parseOrganizationSitePolicy(input.site) } }
const parseExtensionHealth = (value: unknown): ExtensionHealth => { const input = object(value, ["email", "state"], ["memberId", "extensionVersion", "policyVersion", "intelligenceVersion", "lastSeen"]); return { email: nonEmptyString(input.email, 320), state: oneOf(input.state, ["active", "stale", "protection-unavailable"] as const), memberId: optional(input.memberId, (item) => nonEmptyString(item, 64)), extensionVersion: optional(input.extensionVersion, (item) => nonEmptyString(item, 40)), policyVersion: optional(input.policyVersion, nonNegativeInteger), intelligenceVersion: optional(input.intelligenceVersion, (item) => nonEmptyString(item, 120)), lastSeen: optional(input.lastSeen, isoDate) } }
export const parseExtensionHealthResponse = (value: unknown) => { const input = object(value, ["health"]); return { health: array(input.health, parseExtensionHealth, 5000) } }
