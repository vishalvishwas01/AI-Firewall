import type { ReportSite } from "./types"
const extensionId = import.meta.env.VITE_EXTENSION_ID as string

export const hostnameMatchesSite = (hostname: string, siteHostname: string) => hostname === siteHostname || hostname.endsWith(`.${siteHostname}`)
export const sendSitesToExtension = async (sites: ReportSite[]) => {
  const sendMessage = window.chrome?.runtime?.sendMessage
  if (!extensionId || !sendMessage) return
  await new Promise<void>((resolve) => sendMessage(extensionId, {
    type: "AI_FIREWALL_PROTECTED_SITES",
    sites: sites.map(({ hostname, label, isDefault, source, managed, organizationId, organizationName }) => ({ hostname, label, isDefault, source, managed, organizationId, organizationName }))
  }, () => resolve()))
}
