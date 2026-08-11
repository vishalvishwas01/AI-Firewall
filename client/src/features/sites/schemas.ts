import { boolean, isoDate, nonEmptyString, object, oneOf, optional, array, number, ResponseValidationError } from "../../lib/schema"
import type { OrganizationPolicy, ReportSite } from "./types"

export const parseOrganizationPolicy = (value: unknown): OrganizationPolicy => {
  const input = object(value, ["schemaVersion", "version", "category", "minimumSeverity", "action", "destination", "allowOverride", "redactionAllowed"])
  const version = number(input.version)
  if (input.schemaVersion !== 1 || !Number.isInteger(version) || version < 1) throw new ResponseValidationError()
  return { schemaVersion: 1, version, category: oneOf(input.category, ["all", "sensitive-data", "prompt-injection", "risky-upload", "scam-fraud"] as const), minimumSeverity: oneOf(input.minimumSeverity, ["low", "medium", "high"] as const), action: oneOf(input.action, ["warn", "redact", "block"] as const), destination: oneOf(input.destination, ["any", "public-ai", "approved-internal", "unknown"] as const), allowOverride: boolean(input.allowOverride), redactionAllowed: boolean(input.redactionAllowed) }
}

export const parseReportSite = (value: unknown): ReportSite => {
  const input = object(value, ["hostname", "label", "isDefault", "source", "managed", "createdAt", "updatedAt"], ["id", "organizationId", "organizationName", "policy"])
  return {
    id: optional(input.id, (item) => nonEmptyString(item, 64)), hostname: nonEmptyString(input.hostname, 180), label: nonEmptyString(input.label, 120),
    isDefault: boolean(input.isDefault), source: oneOf(input.source, ["personal", "organization"] as const), managed: boolean(input.managed),
    organizationId: optional(input.organizationId, (item) => nonEmptyString(item, 64)), organizationName: optional(input.organizationName, (item) => nonEmptyString(item, 120)), policy: optional(input.policy, parseOrganizationPolicy),
    createdAt: isoDate(input.createdAt), updatedAt: isoDate(input.updatedAt)
  }
}
export const parseSitesResponse = (value: unknown) => { const input = object(value, ["sites"]); return { sites: array(input.sites, parseReportSite, 2000) } }
export const parseSiteResponse = (value: unknown) => { const input = object(value, ["site"]); return { site: parseReportSite(input.site) } }
