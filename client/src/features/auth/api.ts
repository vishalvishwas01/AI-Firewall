import { apiBaseUrl, apiRequest, parseResponse } from "../../lib/http"
import type { AuthResponse, SessionUser } from "./types"

export const getSession = async () => {
  const response = await fetch(`${apiBaseUrl}/auth/session`, { credentials: "include" })
  if (response.status === 401) return { user: null }
  return parseResponse<{ user: SessionUser | null }>(response)
}
export const signup = (email: string, password: string) => apiRequest<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) })
export const login = (email: string, password: string) => apiRequest<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
export const logout = () => apiRequest<void>("/auth/logout", { method: "POST" })
