export type ReportSite = {
  id?: string; hostname: string; label: string; isDefault: boolean
  source: "personal" | "organization"; managed: boolean
  organizationId?: string; organizationName?: string; createdAt: string; updatedAt: string
}
