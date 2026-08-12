import { saveAuthToken } from "./features/auth"
import {
  retryQueuedSyncLogs,
  saveProtectedSites
} from "./features/storage"
import type { OrganizationPolicy, ProtectedSite } from "./features/storage"
import { retryQueuedImprovementEvents } from "./features/improvementTelemetry"
import {
  initializeIntelligenceRefreshScheduler,
  runConfiguredIntelligenceRefresh
} from "./features/intelligence"
import { initializeHealthHeartbeat, sendHealthHeartbeat } from "./features/health"
import { loadActiveIntelligenceRuntime } from "./features/intelligence"
import { getProtectedSites } from "./features/storage"

void retryQueuedSyncLogs().catch(() => undefined)
void retryQueuedImprovementEvents().catch(() => undefined)
initializeIntelligenceRefreshScheduler()
void runConfiguredIntelligenceRefresh()

const reportHealth = async () => {
  const sites = await getProtectedSites()
  const policyVersion = sites.reduce((maximum, site) => Math.max(maximum, site.policy?.version ?? 0), 0) || undefined
  await sendHealthHeartbeat(policyVersion, await loadActiveIntelligenceRuntime())
}
initializeHealthHeartbeat(reportHealth)
void reportHealth().catch(() => undefined)

const hostnameMatchesSite = (hostname: string, siteHostname: string) =>
  hostname === siteHostname || hostname.endsWith(`.${siteHostname}`)

const policyFromMessage = (value: unknown): OrganizationPolicy | undefined => {
  if (!value || typeof value !== "object") return undefined
  const policy = value as Record<string, unknown>
  const keys = ["schemaVersion", "version", "category", "minimumSeverity", "action", "destination", "allowOverride", "redactionAllowed"]
  if (Object.keys(policy).some((key) => !keys.includes(key)) || policy.schemaVersion !== 1 || typeof policy.version !== "number" || !Number.isInteger(policy.version) || policy.version < 1 || !["all", "sensitive-data", "prompt-injection", "risky-upload", "scam-fraud"].includes(String(policy.category)) || !["low", "medium", "high"].includes(String(policy.minimumSeverity)) || !["warn", "redact", "block"].includes(String(policy.action)) || !["any", "public-ai", "approved-internal", "unknown"].includes(String(policy.destination)) || typeof policy.allowOverride !== "boolean" || typeof policy.redactionAllowed !== "boolean" || (policy.action === "redact" && !policy.redactionAllowed) || (policy.action === "warn" && !policy.allowOverride)) return undefined
  return policy as OrganizationPolicy
}

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
    const policy = "policy" in site ? policyFromMessage(site.policy) : undefined
    if ("policy" in site && !policy) return []

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
        : {}),
      ...(policy ? { policy } : {})
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
      void saveAuthToken(message.token).then(() => Promise.all([
        retryQueuedSyncLogs(),
        retryQueuedImprovementEvents(),
        runConfiguredIntelligenceRefresh()
      ])).then(() => {
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
