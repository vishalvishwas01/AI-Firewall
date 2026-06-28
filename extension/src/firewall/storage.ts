import { defaultSettings } from "./detectors"
import { syncActivityLog } from "./sync"
import type { ActivityLog, ProtectionSettings } from "./types"

const settingsKey = "ai-firewall-settings"
const logsKey = "ai-firewall-activity"
const syncQueueKey = "ai-firewall-sync-queue"
const maxLogs = 50
const maxQueuedLogs = 100

const localFallback = new Map<string, unknown>()

const storageArea = () => {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    return chrome.storage.local
  }

  return undefined
}

const getValue = async <T>(key: string, fallback: T): Promise<T> => {
  const area = storageArea()

  if (!area) {
    return (localFallback.get(key) as T | undefined) ?? fallback
  }

  const result = await area.get(key)
  return (result[key] as T | undefined) ?? fallback
}

const setValue = async (key: string, value: unknown): Promise<void> => {
  const area = storageArea()

  if (!area) {
    localFallback.set(key, value)
    return
  }

  await area.set({ [key]: value })
}

export const getSettings = async (): Promise<ProtectionSettings> => {
  const stored = await getValue<Partial<ProtectionSettings>>(settingsKey, {})
  return { ...defaultSettings, ...stored }
}

export const saveSettings = async (settings: ProtectionSettings): Promise<void> => {
  await setValue(settingsKey, settings)
}

export const setSetting = async (
  key: keyof ProtectionSettings,
  value: boolean
): Promise<ProtectionSettings> => {
  const settings = await getSettings()
  const next = { ...settings, [key]: value }
  await saveSettings(next)
  return next
}

export const getActivityLogs = async (): Promise<ActivityLog[]> => {
  return getValue<ActivityLog[]>(logsKey, [])
}

export const getQueuedSyncLogs = async (): Promise<ActivityLog[]> => {
  return getValue<ActivityLog[]>(syncQueueKey, [])
}

const saveQueuedSyncLogs = async (logs: ActivityLog[]): Promise<void> => {
  await setValue(syncQueueKey, logs.slice(0, maxQueuedLogs))
}

const queueSyncLog = async (log: ActivityLog): Promise<void> => {
  const queued = await getQueuedSyncLogs()
  if (queued.some((item) => item.id === log.id)) return
  await saveQueuedSyncLogs([log, ...queued])
}

const requestBackgroundSync = () => {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return
  }

  chrome.runtime.sendMessage({ type: "AI_FIREWALL_SYNC_QUEUED_LOGS" }, () => {
    void chrome.runtime.lastError
  })
}

export const retryQueuedSyncLogs = async (): Promise<void> => {
  const queued = await getQueuedSyncLogs()
  if (queued.length === 0) return

  const remaining: ActivityLog[] = []

  for (const log of queued) {
    try {
      const synced = await syncActivityLog(log)
      if (!synced) {
        remaining.push(log)
      }
    } catch {
      remaining.push(log)
    }
  }

  await saveQueuedSyncLogs(remaining)
}

export const addActivityLog = async (log: ActivityLog): Promise<ActivityLog[]> => {
  const logs = await getActivityLogs()
  const next = [log, ...logs].slice(0, maxLogs)
  await setValue(logsKey, next)
  await queueSyncLog(log)

  requestBackgroundSync()

  return next
}

export const clearActivityLogs = async (): Promise<void> => {
  await setValue(logsKey, [])
}
