import { getSettings } from "../storage"
import type { ImprovementEvent } from "./contracts"
import { deleteRemoteImprovementEvents, syncImprovementEvents } from "./sync"

const queueKey = "ai-firewall-improvement-queue"
const maxQueuedEvents = 100
let syncInFlight: Promise<void> | undefined
let syncRequested = false
let syncDebounceTimer: ReturnType<typeof setTimeout> | undefined
const fallback = new Map<string, unknown>()
const area = () => typeof chrome !== "undefined" && chrome.storage?.local ? chrome.storage.local : undefined
const getValue = async <T>(key: string, defaultValue: T) => { const storage = area(); if (!storage) return (fallback.get(key) as T | undefined) ?? defaultValue; const result = await storage.get(key); return (result[key] as T | undefined) ?? defaultValue }
const setValue = async (key: string, value: unknown) => { const storage = area(); if (!storage) { fallback.set(key, value); return }; await storage.set({ [key]: value }) }

export const getQueuedImprovementEvents = () => getValue<ImprovementEvent[]>(queueKey, [])
const saveQueue = (events: ImprovementEvent[]) => setValue(queueKey, events.slice(0, maxQueuedEvents))
const requestSync = () => { if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return; if (syncDebounceTimer) clearTimeout(syncDebounceTimer); syncDebounceTimer = setTimeout(() => { syncDebounceTimer = undefined; if (syncRequested) return; syncRequested = true; chrome.runtime.sendMessage({ type: "AI_FIREWALL_SYNC_IMPROVEMENT_EVENTS" }, () => { void chrome.runtime.lastError }) }, 1500) }

export const queueImprovementEvents = async (events: ImprovementEvent[]) => {
  if (events.length === 0 || !(await getSettings()).improveDetection) return
  const queued = await getQueuedImprovementEvents()
  const existing = new Set(queued.map((item) => item.eventId))
  await saveQueue([...events.filter((item) => !existing.has(item.eventId)), ...queued])
  requestSync()
}

export const retryQueuedImprovementEvents = async () => {
  if (syncInFlight) return syncInFlight
  syncRequested = false
  syncInFlight = (async () => {
  if (!(await getSettings()).improveDetection) return
  const queued = await getQueuedImprovementEvents()
  const remaining: ImprovementEvent[] = []
  for (let index = 0; index < queued.length; index += 25) { const chunk = queued.slice(index, index + 25); try { const synced = await syncImprovementEvents(chunk); chunk.forEach((event, offset) => { if (!synced[offset]) remaining.push(event) }) } catch { remaining.push(...chunk) } }
  await saveQueue(remaining)
  })().finally(() => { syncInFlight = undefined })
  return syncInFlight
}

export const clearImprovementTelemetry = async () => {
  await saveQueue([])
  try { await deleteRemoteImprovementEvents() } catch { /* Local deletion must still succeed offline. */ }
}
