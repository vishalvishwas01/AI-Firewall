import type { ReportSiteDocument } from "../../models/reportSite.js"
import type { OrganizationDocument, OrganizationSitePolicyDocument } from "../../models/organization.js"

export type PublicReportSite = ReturnType<typeof toPublicSite> & {
  source: "personal" | "organization"
  managed: boolean
  organizationId?: string
  organizationName?: string
}

export const toPublicSite = (site: ReportSiteDocument) => ({
  id: site._id?.toHexString(),
  hostname: site.hostname,
  label: site.label,
  isDefault: site.isDefault,
  createdAt: site.createdAt.toISOString(),
  updatedAt: site.updatedAt.toISOString()
})

export const mergeVisibleSites = (
  personalSites: ReportSiteDocument[],
  organizations: OrganizationDocument[],
  policies: OrganizationSitePolicyDocument[]
) => {
  const organizationNames = new Map(organizations.flatMap((organization) =>
    organization._id ? [[organization._id.toHexString(), organization.name] as const] : []
  ))
  const merged = new Map<string, PublicReportSite>(personalSites.map((site) => [site.hostname, {
    ...toPublicSite(site), source: "personal" as const, managed: false
  }]))
  for (const policy of policies) {
    const organizationId = policy.organizationId.toHexString()
    const personalSite = merged.get(policy.hostname)
    merged.set(policy.hostname, {
      ...(personalSite ?? {
        id: policy._id?.toHexString(), hostname: policy.hostname, label: policy.label,
        isDefault: false, createdAt: policy.createdAt.toISOString(), updatedAt: policy.updatedAt.toISOString(),
        source: "organization" as const
      }),
      managed: true,
      organizationId,
      organizationName: organizationNames.get(organizationId) ?? "Organization"
    })
  }
  return [...merged.values()].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label))
}
