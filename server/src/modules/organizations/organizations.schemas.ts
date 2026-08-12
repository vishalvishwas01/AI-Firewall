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

const policyCategories = ["all", "sensitive-data", "prompt-injection", "risky-upload", "scam-fraud"] as const
const policySeverities = ["low", "medium", "high"] as const
const policyActions = ["warn", "redact", "block"] as const
const policyDestinations = ["any", "public-ai", "approved-internal", "unknown"] as const

export const defaultOrganizationPolicy = {
  schemaVersion: 1 as const, version: 1, category: "all" as const, minimumSeverity: "high" as const,
  action: "block" as const, destination: "any" as const, allowOverride: false, redactionAllowed: true
}

type ParsedOrganizationPolicy = {
  schemaVersion: 1
  version: number
  category: (typeof policyCategories)[number]
  minimumSeverity: (typeof policySeverities)[number]
  action: (typeof policyActions)[number]
  destination: (typeof policyDestinations)[number]
  allowOverride: boolean
  redactionAllowed: boolean
}

export const parseOrganizationPolicy = (value: unknown): ParsedOrganizationPolicy | { error: string } => {
  const body = exactObject(value, ["schemaVersion", "version", "category", "minimumSeverity", "action", "destination", "allowOverride", "redactionAllowed"])
  if (body.schemaVersion !== 1 || typeof body.version !== "number" || !Number.isInteger(body.version) || body.version < 1) return { error: "Invalid organization policy" }
  if (!isOneOf(body.category, policyCategories) || !isOneOf(body.minimumSeverity, policySeverities) || !isOneOf(body.action, policyActions) || !isOneOf(body.destination, policyDestinations) || typeof body.allowOverride !== "boolean" || typeof body.redactionAllowed !== "boolean") return { error: "Invalid organization policy" }
  if (body.action === "redact" && !body.redactionAllowed) return { error: "Redaction policy must allow redaction" }
  if (body.action === "warn" && !body.allowOverride) return { error: "Warning policy must allow override" }
  return { schemaVersion: 1 as const, version: body.version, category: body.category, minimumSeverity: body.minimumSeverity, action: body.action, destination: body.destination, allowOverride: body.allowOverride, redactionAllowed: body.redactionAllowed }
}

export const isOneOf = <T extends readonly string[]>(value: unknown, allowed: T): value is T[number] =>
  typeof value === "string" && allowed.includes(value)

export const parseOrganizationInput = (value: unknown) => {
  const body = exactObject(value, ["name"], "Invalid organization request")
  const name = normalizeName(body.name)
  return name && name.length <= 100 ? { name } : { error: "Enter an organization name" }
}

export const parseOrganizationSiteInput = (value: unknown) => {
  const body = exactObject(value, ["hostname", "label"], ["policy"], "Invalid organization site request")
  const hostname = normalizeHostname(body.hostname)
  const label = normalizeSiteLabel(body.label)
  if (!(hostname && hostname.length <= 180 && label && label.length <= 80 && hostname.includes("."))) return { error: "Enter a domain and website name" }
  const policy = body.policy === undefined ? defaultOrganizationPolicy : parseOrganizationPolicy(body.policy)
  return "error" in policy ? policy : { hostname, label, policy }
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
