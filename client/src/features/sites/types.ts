export type ReportSite = {
  id?: string; hostname: string; label: string; isDefault: boolean
  source: "personal" | "organization"; managed: boolean
  organizationId?: string; organizationName?: string; createdAt: string; updatedAt: string; policy?: OrganizationPolicy
}
export type OrganizationPolicy = { schemaVersion: 1; version: number; category: "all" | "sensitive-data" | "prompt-injection" | "risky-upload" | "scam-fraud"; minimumSeverity: "low" | "medium" | "high"; action: "warn" | "redact" | "block"; destination: "any" | "public-ai" | "approved-internal" | "unknown"; allowOverride: boolean; redactionAllowed: boolean }
