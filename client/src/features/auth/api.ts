import { apiBaseUrl, apiRequest, parseResponse, TransportError } from "../../lib/http"
import type { AuthResponse, SessionUser } from "./types"
import { parseAuthResponse, parseSessionResponse } from "./schemas"

export const getSession = async () => {
  try {
    const response = await fetch(`${apiBaseUrl}/auth/session`, { credentials: "include" })
    if (response.status === 401) return { user: null }
    return parseResponse<{ user: SessionUser | null }>(response, parseSessionResponse)
  } catch (error) {
    if (error instanceof TransportError) throw error
    throw new TransportError("network_error")
  }
}
export const signup = (email: string, password: string) => apiRequest<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }, parseAuthResponse)
export const login = (email: string, password: string) => apiRequest<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, parseAuthResponse)
export const logout = () => apiRequest<void>("/auth/logout", { method: "POST" })
export const startGoogleLogin = () => {window.location.href = `${apiBaseUrl}/auth/google`}
