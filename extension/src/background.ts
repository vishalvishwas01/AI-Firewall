import { saveAuthToken } from "./features/auth"
import {
  retryQueuedSyncLogs,
  saveProtectedSites
} from "./features/storage"
import type { ProtectedSite } from "./features/storage"
import { retryQueuedImprovementEvents } from "./features/improvementTelemetry"

void retryQueuedSyncLogs().catch(() => undefined)
void retryQueuedImprovementEvents().catch(() => undefined)

const hostnameMatchesSite = (hostname: string, siteHostname: string) =>
  hostname === siteHostname || hostname.endsWith(`.${siteHostname}`)

const protectedSitesFromMessage = (value: unknown): ProtectedSite[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((site) => {
    if (
      typeof site !== "object" ||
      site === null ||
      !("hostname" in site) ||
      !("label" in site) ||
      typeof site.hostname !== "string" ||
      typeof site.label !== "string"
    ) {
      return []
    }

    return [{
      hostname: site.hostname,
      label: site.label,
      isDefault: "isDefault" in site && site.isDefault === true,
      source: "source" in site && site.source === "organization" ? "organization" as const : "personal" as const,
      managed: "managed" in site && site.managed === true,
      ...("organizationId" in site && typeof site.organizationId === "string"
        ? { organizationId: site.organizationId }
        : {}),
      ...("organizationName" in site && typeof site.organizationName === "string"
        ? { organizationName: site.organizationName }
        : {})
    }]
  })
}

const refreshMatchingTabs = async (sites: ProtectedSite[]) => {
  if (typeof chrome === "undefined" || !chrome.tabs?.query || !chrome.tabs.reload) {
    return
  }

  const tabs = await chrome.tabs.query({})

  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id || !tab.url) return

      try {
        const hostname = new URL(tab.url).hostname.replace(/^www\./, "")
        if (sites.some((site) => hostnameMatchesSite(hostname, site.hostname))) {
          await chrome.tabs.reload(tab.id)
        }
      } catch {
        return
      }
    })
  )
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "AI_FIREWALL_SYNC_QUEUED_LOGS"
    ) {
      void retryQueuedSyncLogs().then(() => {
        sendResponse({ ok: true })
      })
      return true
    }

    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "AI_FIREWALL_SYNC_IMPROVEMENT_EVENTS"
    ) {
      void retryQueuedImprovementEvents().then(() => sendResponse({ ok: true }))
      return true
    }

    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "AI_FIREWALL_PROTECTED_SITES" &&
      "sites" in message &&
      Array.isArray(message.sites)
    ) {
      const sites = protectedSitesFromMessage(message.sites)

      void saveProtectedSites(sites)
        .then(() => refreshMatchingTabs(sites))
        .then(() => {
          sendResponse({ ok: true })
        })
      return true
    }

    return false
  })
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "AI_FIREWALL_AUTH_TOKEN" &&
      "token" in message &&
      typeof message.token === "string"
    ) {
      void saveAuthToken(message.token).then(() => Promise.all([retryQueuedSyncLogs(), retryQueuedImprovementEvents()])).then(() => {
        sendResponse({ ok: true })
      })
      return true
    }

    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "AI_FIREWALL_PROTECTED_SITES" &&
      "sites" in message &&
      Array.isArray(message.sites)
    ) {
      const sites = protectedSitesFromMessage(message.sites)

      void saveProtectedSites(sites)
        .then(() => refreshMatchingTabs(sites))
        .then(() => {
          sendResponse({ ok: true })
        })
      return true
    }

    sendResponse({ ok: false })
    return false
  })
}
