import { apiUrl, getAuthStatus, getAuthToken } from "../auth"
import type { ImprovementEvent } from "./contracts"

const authHeaders = async () => {
  const token = await getAuthToken()
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

export const syncImprovementEvent = async (event: ImprovementEvent) => {
  if (!(await getAuthStatus()).isAuthenticated) return false
  const response = await fetch(apiUrl("/improvement-events"), { method: "POST", credentials: "include", headers: await authHeaders(), body: JSON.stringify(event) })
  if (response.status === 401) return false
  if (!response.ok) throw new Error("Failed to sync improvement event")
  return true
}

export const deleteRemoteImprovementEvents = async () => {
  if (!(await getAuthStatus()).isAuthenticated) return false
  const response = await fetch(apiUrl("/improvement-events"), { method: "DELETE", credentials: "include", headers: await authHeaders() })
  if (response.status === 401) return false
  if (!response.ok) throw new Error("Failed to clear improvement events")
  return true
}
