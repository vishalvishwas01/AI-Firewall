import { boolean, isoDate, nonEmptyString, object, oneOf, optional, array } from "../../lib/schema"
import type { ReportSite } from "./types"

export const parseReportSite = (value: unknown): ReportSite => {
  const input = object(value, ["hostname", "label", "isDefault", "source", "managed", "createdAt", "updatedAt"], ["id", "organizationId", "organizationName"])
  return {
    id: optional(input.id, (item) => nonEmptyString(item, 64)), hostname: nonEmptyString(input.hostname, 180), label: nonEmptyString(input.label, 120),
    isDefault: boolean(input.isDefault), source: oneOf(input.source, ["personal", "organization"] as const), managed: boolean(input.managed),
    organizationId: optional(input.organizationId, (item) => nonEmptyString(item, 64)), organizationName: optional(input.organizationName, (item) => nonEmptyString(item, 120)),
    createdAt: isoDate(input.createdAt), updatedAt: isoDate(input.updatedAt)
  }
}
export const parseSitesResponse = (value: unknown) => { const input = object(value, ["sites"]); return { sites: array(input.sites, parseReportSite, 2000) } }
export const parseSiteResponse = (value: unknown) => { const input = object(value, ["site"]); return { site: parseReportSite(input.site) } }
