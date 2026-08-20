import { apiUrl, getAuthStatus, getAuthToken } from "../auth"
import type { ImprovementEvent } from "./contracts"

const authHeaders = async () => {
  const token = await getAuthToken()
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

export const syncImprovementEvents = async (events: ImprovementEvent[]) => {
  if (events.length === 0) return []
  const token = await getAuthToken()
  if (!token) return events.map(() => false)
  const response = await fetch(apiUrl("/improvement-events/batch"), { method: "POST", credentials: "include", headers: await authHeaders(), body: JSON.stringify({ events }) })
  if (response.status === 401) return events.map(() => false)
  if (!response.ok) throw new Error("Failed to sync improvement events")
  return events.map(() => true)
}
export const syncImprovementEvent = async (event: ImprovementEvent) => (await syncImprovementEvents([event]))[0] ?? false

export const deleteRemoteImprovementEvents = async () => {
  if (!(await getAuthStatus()).isAuthenticated) return false
  const response = await fetch(apiUrl("/improvement-events"), { method: "DELETE", credentials: "include", headers: await authHeaders() })
  if (response.status === 401) return false
  if (!response.ok) throw new Error("Failed to clear improvement events")
  return true
}
