import type { ReportSummary } from "../reports/types"
export type OrganizationRole = "owner" | "admin" | "member"
export type Organization = { id: string; name: string; role: OrganizationRole; createdAt: string; updatedAt: string }
export type OrganizationMember = { id: string; userId?: string; email: string; role: OrganizationRole; status: "active" | "invited" | "revoked"; revokedAt?: string; createdAt: string; updatedAt: string }
export type OrganizationSummary = ReportSummary & { activeMembers: number; invitedMembers: number; revokedInvitations: number }
export type OrganizationTrendPoint = { date: string; totalLogs: number; bySeverity: ReportSummary["bySeverity"]; byEventType: ReportSummary["byEventType"]; byFeedback: ReportSummary["byFeedback"] }
export type OrganizationTrends = { rangeDays: 7 | 30 | 90; bucket: "day"; from: string; to: string; points: OrganizationTrendPoint[] }
export type OrganizationSitePolicy = { id: string; hostname: string; label: string; createdAt: string; updatedAt: string; policy?: import("../sites/types").OrganizationPolicy }
