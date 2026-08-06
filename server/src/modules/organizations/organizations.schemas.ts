import { ValidationError } from "../../shared/errors.js"
import { exactObject } from "../../shared/validation.js"
import { organizationTrendRangeDays, type OrganizationTrendDays } from "../../utils/organizationTrends.js"

export const organizationRoles = ["admin", "member"] as const

export const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : ""

export const normalizeName = (value: unknown) =>
  typeof value === "string" ? value.trim() : ""

export const normalizeHostname = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (!raw) return ""
  try {
    const withProtocol = raw.startsWith("http://") || raw.startsWith("https://")
    return new URL(withProtocol ? raw : `https://${raw}`).hostname.replace(/^www\./, "")
  } catch {
    return raw.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "")
  }
}

export const normalizeSiteLabel = (value: unknown) =>
  typeof value === "string" ? value.trim() : ""

export const routeParam = (value: string | string[]) => Array.isArray(value) ? value[0] ?? "" : value

export const isOneOf = <T extends readonly string[]>(value: unknown, allowed: T): value is T[number] =>
  typeof value === "string" && allowed.includes(value)

export const parseOrganizationInput = (value: unknown) => {
  const body = exactObject(value, ["name"], "Invalid organization request")
  const name = normalizeName(body.name)
  return name && name.length <= 100 ? { name } : { error: "Enter an organization name" }
}

export const parseOrganizationSiteInput = (value: unknown) => {
  const body = exactObject(value, ["hostname", "label"], "Invalid organization site request")
  const hostname = normalizeHostname(body.hostname)
  const label = normalizeSiteLabel(body.label)
  return hostname && hostname.length <= 180 && label && label.length <= 80 && hostname.includes(".") ? { hostname, label } : { error: "Enter a domain and website name" }
}

export const parseMemberInput = (value: unknown) => {
  const body = exactObject(value, ["email", "role"], "Invalid organization member request")
  const email = normalizeEmail(body.email)
  if (body.role !== undefined && !isOneOf(body.role, organizationRoles)) return { error: "Choose a valid role" }
  const role = isOneOf(body.role, organizationRoles) ? body.role : "member"
  return email && email.length <= 180 && email.includes("@") ? { email, role } : { error: "Enter a valid member email" }
}

export const parseRoleInput = (value: unknown) => {
  const body = exactObject(value, ["role"], "Invalid organization role request")
  return isOneOf(body.role, organizationRoles) ? { role: body.role } : { error: "Choose a valid role" }
}

export const parseTrendQuery = (value: unknown): OrganizationTrendDays => {
  const query = exactObject(value, ["days"], "Invalid organization trend query")
  if (query.days === undefined) return 30
  const parsed = typeof query.days === "string" && /^\d{1,2}$/.test(query.days) ? Number(query.days) : Number.NaN
  if (!organizationTrendRangeDays.includes(parsed as OrganizationTrendDays)) {
    throw new ValidationError("Invalid organization trend query")
  }
  return parsed as OrganizationTrendDays
}

export const isParsedInput = <T extends object>(value: T | { error: string }): value is T => !("error" in value)
