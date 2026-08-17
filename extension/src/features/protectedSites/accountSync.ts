import { apiUrl, getAuthToken } from "../auth"
import { getProtectedSites, saveProtectedSites } from "../storage/storage"
import type { OrganizationPolicy, ProtectedSite } from "../../firewall/types"

const siteFromApi = (value: unknown): ProtectedSite | undefined => {
  if (!value || typeof value !== "object") return undefined
  const site = value as Record<string, unknown>
  if (typeof site.hostname !== "string" || typeof site.label !== "string") return undefined
  const policy = site.policy && typeof site.policy === "object" && (site.policy as Record<string, unknown>).schemaVersion === 1
    ? site.policy as OrganizationPolicy
    : undefined
  return {
    hostname: site.hostname,
    label: site.label,
    isDefault: site.isDefault === true,
    source: site.source === "organization" ? "organization" : "personal",
    managed: site.managed === true,
    ...(typeof site.organizationId === "string" ? { organizationId: site.organizationId } : {}),
    ...(typeof site.organizationName === "string" ? { organizationName: site.organizationName } : {}),
    ...(policy ? { policy } : {})
  }
}

export const syncProtectedSitesFromAccount = async (): Promise<ProtectedSite[]> => {
  const token = await getAuthToken()
  const response = await fetch(apiUrl("/sites"), {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (response.status === 401 || response.status === 403) return getProtectedSites()
  if (!response.ok) throw new Error("Protected websites could not be refreshed")
  const body = await response.json() as { sites?: unknown }
  if (!Array.isArray(body.sites)) throw new Error("Invalid protected websites response")
  const sites = body.sites.flatMap((site) => {
    const parsed = siteFromApi(site)
    return parsed ? [parsed] : []
  })
  await saveProtectedSites(sites)
  return sites
}
