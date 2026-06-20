import { defaultSettings } from "./detectors"
import type { ActivityLog, ProtectionSettings } from "./types"

const settingsKey = "ai-firewall-settings"
const logsKey = "ai-firewall-activity"
const maxLogs = 50

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

export const addActivityLog = async (log: ActivityLog): Promise<ActivityLog[]> => {
  const logs = await getActivityLogs()
  const next = [log, ...logs].slice(0, maxLogs)
  await setValue(logsKey, next)
  return next
}

export const clearActivityLogs = async (): Promise<void> => {
  await setValue(logsKey, [])
}
