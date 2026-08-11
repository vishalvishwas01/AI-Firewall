import type { IntelligenceCapability } from "./contracts"
import { refreshIntelligencePackage } from "./download"
import { loadConfiguredIntelligenceRootKeys } from "./rootKeys"
import {
  getIntelligenceRefreshStatus,
  saveIntelligenceRefreshStatus
} from "./refreshStatus"

export const intelligenceRefreshAlarmName = "ai-firewall-intelligence-refresh"
export const intelligenceRefreshRetryAlarmName = "ai-firewall-intelligence-refresh-retry"
export const intelligenceRefreshPeriodMinutes = 6 * 60
export const intelligenceRefreshInitialDelayMinutes = 1
export const intelligenceRefreshRetryDelayMinutes = 5

const supportedCapabilities: IntelligenceCapability[] = [
  "rules-v1",
  "model-v2",
  "candidate-features-v1"
]

type RefreshResult =
  | { status: "disabled" }
  | { status: "unchanged" }
  | { status: "failed" }
  | { status: "activated"; packageVersion: string; sequence: number }

type RefreshDependencies = {
  rootKeys?: Record<string, string>
  extensionVersion?: string
  refresh?: typeof refreshIntelligencePackage
}

let refreshInFlight: Promise<RefreshResult> | undefined

const manifestVersion = () => {
  if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
    return chrome.runtime.getManifest().version
  }
  return "0.1.0"
}

export const runConfiguredIntelligenceRefresh = (
  dependencies: RefreshDependencies = {}
): Promise<RefreshResult> => {
  if (refreshInFlight) return refreshInFlight
  const rootKeys = dependencies.rootKeys ?? loadConfiguredIntelligenceRootKeys()
  if (!rootKeys) {
    return saveIntelligenceRefreshStatus({
      state: "disabled",
      consecutiveFailures: 0
    }).then(() => ({ status: "disabled" as const }))
  }
  const refresh = dependencies.refresh ?? refreshIntelligencePackage
  refreshInFlight = (async () => {
    const attemptAt = new Date().toISOString()
    await saveIntelligenceRefreshStatus({
      state: "refreshing",
      lastAttemptAt: attemptAt
    })
    try {
      const active = await refresh({
        trustedRootKeys: rootKeys,
        extensionVersion: dependencies.extensionVersion ?? manifestVersion(),
        supportedCapabilities
      })
      if (!active) {
        await saveIntelligenceRefreshStatus({
          state: "unchanged",
          consecutiveFailures: 0,
          lastSuccessAt: attemptAt
        })
        return { status: "unchanged" as const }
      }
      await saveIntelligenceRefreshStatus({
        state: "activated",
        consecutiveFailures: 0,
        lastSuccessAt: attemptAt,
        packageVersion: active.manifest.packageVersion,
        sequence: active.manifest.sequence
      })
      return {
        status: "activated" as const,
        packageVersion: active.manifest.packageVersion,
        sequence: active.manifest.sequence
      }
    } catch {
      const currentStatus = await getIntelligenceRefreshStatus()
      const failures = await saveIntelligenceRefreshStatus({
        state: "failed",
        consecutiveFailures: Math.min(3, currentStatus.consecutiveFailures + 1)
      })
      if (
        typeof chrome !== "undefined"
        && chrome.alarms?.create
        && failures.consecutiveFailures < 3
      ) {
        chrome.alarms.create(intelligenceRefreshRetryAlarmName, {
          delayInMinutes: intelligenceRefreshRetryDelayMinutes
        })
      }
      return { status: "failed" as const }
    }
  })()
    .finally(() => {
      refreshInFlight = undefined
    })
  return refreshInFlight
}

export const initializeIntelligenceRefreshScheduler = () => {
  if (typeof chrome === "undefined" || !chrome.alarms?.create || !chrome.alarms?.onAlarm) return
  chrome.alarms.create(intelligenceRefreshAlarmName, {
    delayInMinutes: intelligenceRefreshInitialDelayMinutes,
    periodInMinutes: intelligenceRefreshPeriodMinutes
  })
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (
      alarm.name === intelligenceRefreshAlarmName
      || alarm.name === intelligenceRefreshRetryAlarmName
    ) {
      void runConfiguredIntelligenceRefresh()
    }
  })
}
